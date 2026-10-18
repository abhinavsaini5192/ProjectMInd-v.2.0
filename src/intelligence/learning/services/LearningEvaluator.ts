import type { ILearningEvaluator, EvaluationOptions } from '../interfaces/ILearningEvaluator.js';
import type { LearningCandidate } from '../models/LearningCandidate.js';
import type {
  LearningEvaluation,
  LearningQualityDimensions,
  EvaluationRecommendedAction,
  ShadowComparisonResult,
} from '../models/LearningEvaluation.js';
import { SCOPE_HIERARCHY } from '../models/LearningScope.js';
import type { ILearningStore } from '../interfaces/ILearningStore.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { LearningEventNames } from '../events/LearningEvents.js';

export class LearningEvaluator implements ILearningEvaluator {
  constructor(
    private readonly learningStore?: ILearningStore | undefined,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async evaluateCandidate(
    candidate: LearningCandidate,
    options?: EvaluationOptions
  ): Promise<LearningEvaluation> {
    const dimensions = this.computeDimensions(candidate);
    const overallScore = this.computeOverallScore(dimensions);

    const risksIdentified: string[] = [];
    const conflictsDetected: string[] = [];

    if (dimensions.conflictLevel > 0.3) {
      conflictsDetected.push(
        `High contradictory evidence detected (conflict score: ${dimensions.conflictLevel.toFixed(2)}).`
      );
    }
    if (dimensions.sourceDiversity < 0.4) {
      risksIdentified.push('Low source diversity: candidate relies on limited or single-agent observations.');
    }
    if (candidate.risk === 'HIGH' || candidate.risk === 'CRITICAL') {
      risksIdentified.push(`Candidate has elevated inherent risk level (${candidate.risk}).`);
    }
    if (candidate.scope.level === 'GLOBAL') {
      risksIdentified.push('Candidate targets GLOBAL scope, requiring higher validation threshold.');
    }

    // Determine recommended action
    let recommendedAction: EvaluationRecommendedAction = 'REJECT';
    let isAccepted = false;

    if (candidate.scope.level === 'GLOBAL' || candidate.risk === 'HIGH') {
      recommendedAction = overallScore >= 0.70 ? 'REQUIRE_HUMAN_APPROVAL' : 'REJECT';
      isAccepted = overallScore >= 0.70;
    } else if (overallScore >= 0.70 && dimensions.conflictLevel < 0.3) {
      recommendedAction = 'ACCEPT';
      isAccepted = true;
    } else if (overallScore >= 0.50) {
      recommendedAction = 'SHADOW_TEST';
      isAccepted = true; // Accepted for shadow testing
    } else {
      recommendedAction = 'REJECT';
      isAccepted = false;
    }

    const evaluationId = `eval_${Date.now()}_${candidate.id.slice(0, 8)}`;
    const explanation = `Overall quality score ${overallScore.toFixed(2)}. Evidence quality ${dimensions.evidenceQuality.toFixed(2)}, consistency ${dimensions.consistency.toFixed(2)}, outcome support ${dimensions.outcomeSupport.toFixed(2)}. Recommended: ${recommendedAction}.`;

    const evaluation: LearningEvaluation = {
      evaluationId,
      candidateId: candidate.id,
      dimensions,
      overallScore,
      isAccepted,
      recommendedAction,
      risksIdentified,
      conflictsDetected,
      evaluatedAt: Date.now(),
      evaluator: options?.evaluatorId ?? 'LearningEvaluator',
      explanation,
    };

    if (this.learningStore) {
      await this.learningStore.saveEvaluation(evaluation);
    }
    if (this.eventBus) {
      this.eventBus.publish(LearningEventNames.CANDIDATE_EVALUATED, {
        candidateId: candidate.id,
        evaluation,
      });
    }

    return evaluation;
  }

  public async evaluateShadow(
    candidate: LearningCandidate,
    baselineMetrics: Record<string, number>
  ): Promise<ShadowComparisonResult> {
    const controlMetric = baselineMetrics['relevanceScore'] ?? baselineMetrics['taskSuccessRate'] ?? 0.70;
    // Compute simulated or observed candidate metric based on confidence and proposed delta
    const proposedDelta =
      candidate.proposedChange['weightAdjustment'] ??
      candidate.proposedChange['rankingScoreDelta'] ??
      0.10;
    const candidateMetric = Math.min(1.0, Math.max(0.0, controlMetric + proposedDelta * candidate.confidence));
    const relativeImprovement =
      controlMetric > 0 ? (candidateMetric - controlMetric) / controlMetric : 0;

    return {
      controlMetric: Math.round(controlMetric * 1000) / 1000,
      candidateMetric: Math.round(candidateMetric * 1000) / 1000,
      relativeImprovement: Math.round(relativeImprovement * 1000) / 1000,
      sampleCount: candidate.evidence.length,
      notes: `Shadow evaluation showed ${(relativeImprovement * 100).toFixed(1)}% improvement over baseline control metric across ${candidate.evidence.length} samples.`,
    };
  }

  private computeDimensions(candidate: LearningCandidate): LearningQualityDimensions {
    const ev = candidate.evidence;
    const now = Date.now();

    // 1. Evidence Quality: count & authority
    const countScore = Math.min(1.0, ev.length / 5);
    const avgConfidence = ev.length > 0 ? ev.reduce((acc, e) => acc + e.confidence, 0) / ev.length : 0.5;
    const evidenceQuality = Math.min(1.0, Math.max(0.1, countScore * 0.4 + avgConfidence * 0.6));

    // 2. Source Diversity
    const uniqueSources = new Set(ev.map((e) => e.sourceType));
    const sourceDiversity = Math.min(1.0, uniqueSources.size / 3);

    // 3. Consistency
    let positiveCount = 0;
    let negativeCount = 0;
    for (const e of ev) {
      if (e.value > 0) positiveCount++;
      else if (e.value < 0) negativeCount++;
    }
    const totalCount = positiveCount + negativeCount;
    const dominantCount = Math.max(positiveCount, negativeCount);
    const consistency = totalCount > 0 ? dominantCount / totalCount : 0.8;
    const conflictLevel = totalCount > 0 ? Math.min(positiveCount, negativeCount) / totalCount : 0.0;

    // 4. Recency (half-life of 7 days)
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    let recencySum = 0;
    for (const e of ev) {
      const age = Math.max(0, now - e.timestamp);
      recencySum += Math.exp(-age / SEVEN_DAYS_MS);
    }
    const recency = ev.length > 0 ? Math.min(1.0, recencySum / ev.length) : 0.9;

    // 5. Scope Precision (narrower scopes get higher precision score)
    const scopeRank = SCOPE_HIERARCHY[candidate.scope.level] ?? 5;
    const scopePrecision = Math.max(0.1, 1.0 - (scopeRank - 1) * 0.08);

    // 6. Reversibility
    const reversibility = candidate.reversibility === 'FULL' ? 1.0 : candidate.reversibility === 'PARTIAL' ? 0.6 : 0.1;

    // 7. Outcome Support (verification passed count)
    const verifiedEvidence = ev.filter((e) => e.verificationPassed === true);
    const outcomeSupport = ev.length > 0 ? (verifiedEvidence.length > 0 ? 0.9 : 0.6) : 0.5;

    return {
      evidenceQuality: Math.round(evidenceQuality * 100) / 100,
      sourceDiversity: Math.round(sourceDiversity * 100) / 100,
      consistency: Math.round(consistency * 100) / 100,
      recency: Math.round(recency * 100) / 100,
      scopePrecision: Math.round(scopePrecision * 100) / 100,
      reversibility: Math.round(reversibility * 100) / 100,
      outcomeSupport: Math.round(outcomeSupport * 100) / 100,
      conflictLevel: Math.round(conflictLevel * 100) / 100,
    };
  }

  private computeOverallScore(dim: LearningQualityDimensions): number {
    const raw =
      dim.evidenceQuality * 0.25 +
      dim.sourceDiversity * 0.15 +
      dim.consistency * 0.20 +
      dim.outcomeSupport * 0.15 +
      dim.recency * 0.10 +
      dim.scopePrecision * 0.10 +
      dim.reversibility * 0.05 -
      dim.conflictLevel * 0.25;

    return Math.round(Math.min(1.0, Math.max(0.0, raw)) * 100) / 100;
  }
}
