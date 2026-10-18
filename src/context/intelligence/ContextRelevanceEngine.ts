import type { ContextCandidate, RelevanceDimensions, CandidatePriority } from '../models/ContextCandidate.js';
import type { TaskUnderstanding } from '../models/TaskUnderstanding.js';
import type { ContextRequest } from '../models/ContextRequest.js';

export class ContextRelevanceEngine {
  public scoreCandidates(
    candidates: readonly ContextCandidate[],
    task: TaskUnderstanding,
    request: ContextRequest
  ): ContextCandidate[] {
    return candidates.map((cand) => {
      const dimensions = this.calculateDimensions(cand, task, request);
      const score = this.calculateCompositeScore(dimensions);
      const priority = this.determinePriority(score, cand, dimensions);
      const primaryEvidence = this.synthesizeEvidence(cand, dimensions, task);

      return {
        ...cand,
        score,
        priority,
        dimensions,
        primaryEvidence,
      };
    });
  }

  private calculateDimensions(
    candidate: ContextCandidate,
    task: TaskUnderstanding,
    request: ContextRequest
  ): RelevanceDimensions {
    const candLower = `${candidate.name} ${candidate.path ?? ''} ${candidate.primaryEvidence}`.toLowerCase();
    const taskWords = task.normalizedRequest.toLowerCase().split(/\W+/).filter((w) => w.length > 2);

    // 1. Task Relevance: lexical, resource, and entity match
    let matchCount = 0;
    for (const word of taskWords) {
      if (candLower.includes(word) || (word.length >= 4 && candLower.includes(word.slice(0, 4)))) {
        matchCount++;
      }
    }
    for (const ent of task.targetEntities) {
      const entLower = ent.toLowerCase();
      if (candLower.includes(entLower)) {
        matchCount += 2;
      } else {
        const parts = entLower.split(/[.#:]/);
        for (const p of parts) {
          if (p.length > 2 && candLower.includes(p)) {
            matchCount += 1.5;
          }
        }
      }
    }
    if (
      candidate.path &&
      task.candidateResources?.some(
        (r) =>
          candidate.path?.toLowerCase().includes(r.toLowerCase()) ||
          r.toLowerCase().includes(candidate.path?.toLowerCase() ?? '')
      )
    ) {
      matchCount += 2.5;
    }
    const taskRelevance = Math.min(1.0, matchCount > 0 ? 0.4 + matchCount * 0.15 : 0.2);

    // 2. Feature Relevance
    const isTargetFeature = task.candidateFeatures.some((f) => candLower.includes(f.toLowerCase()));
    const featureRelevance = isTargetFeature ? 0.95 : candidate.candidateType === 'FEATURE' ? 0.7 : 0.3;

    // 3. Architectural Relevance
    const isCoreArch =
      candLower.includes('service') ||
      candLower.includes('controller') ||
      candLower.includes('repository') ||
      candLower.includes('handler');
    const architecturalRelevance = isCoreArch ? 0.8 : 0.4;

    // 4. Dependency Relevance
    const dependencyRelevance =
      candidate.candidateType === 'DEPENDENCY' ? 0.85 : candidate.candidateType === 'FILE' ? 0.75 : 0.5;

    // 5. Behavioral Relevance
    const behavioralRelevance =
      candidate.candidateType === 'BEHAVIOR_STEP' ? 0.9 : candLower.includes('login') || candLower.includes('auth') ? 0.75 : 0.4;

    // 6. Change Relevance
    const isChanged =
      request.changedResources?.some((r) => candidate.path && r.includes(candidate.path)) ?? false;
    const changeRelevance = isChanged ? 1.0 : 0.3;

    // 7. History Relevance: boosted during bug fix / debugging
    const isHistoryTask =
      task.taskType === 'BUG_FIX' || task.taskType === 'DEBUGGING' || task.taskType === 'INVESTIGATION';
    const historyRelevance =
      candidate.candidateType === 'HISTORY_EVENT' ? (isHistoryTask ? 0.85 : 0.4) : 0.3;

    // 8. Risk Relevance
    const riskRelevance = candidate.candidateType === 'RISK' ? (isHistoryTask ? 0.9 : 0.5) : 0.3;

    // 9. Verification Relevance
    const verificationRelevance =
      candidate.candidateType === 'TEST' ? (isHistoryTask ? 0.95 : 0.5) : 0.4;

    // 10. Recency
    const recency = isChanged ? 0.95 : 0.5;

    // 11. Confidence
    const confidence = task.confidence > 0 ? task.confidence : 0.8;

    // 12. Scope Relevance
    const scopeRelevance = 1.0;

    return {
      taskRelevance,
      featureRelevance,
      architecturalRelevance,
      dependencyRelevance,
      behavioralRelevance,
      changeRelevance,
      historyRelevance,
      riskRelevance,
      verificationRelevance,
      recency,
      confidence,
      scopeRelevance,
    };
  }

  private calculateCompositeScore(dim: RelevanceDimensions): number {
    const raw =
      dim.taskRelevance * 0.35 +
      dim.featureRelevance * 0.20 +
      dim.dependencyRelevance * 0.15 +
      dim.behavioralRelevance * 0.10 +
      dim.changeRelevance * 0.10 +
      dim.recency * 0.10;

    // Bounded between 0.05 and 1.0
    return Math.round(Math.min(1.0, Math.max(0.05, raw)) * 100) / 100;
  }

  private determinePriority(
    score: number,
    cand: ContextCandidate,
    dim: RelevanceDimensions
  ): CandidatePriority {
    if (
      score >= 0.85 ||
      dim.changeRelevance >= 0.95 ||
      cand.metadata?.['isChanged'] === true ||
      cand.metadata?.['isDirectImplementation'] === true ||
      (cand.candidateType === 'FILE' && dim.featureRelevance >= 0.9 && dim.taskRelevance >= 0.7)
    ) {
      return 'CRITICAL';
    }
    if (score >= 0.70) return 'HIGH';
    if (score >= 0.50) return 'MEDIUM';
    if (score >= 0.30) return 'LOW';
    return 'OPTIONAL';
  }

  private synthesizeEvidence(
    candidate: ContextCandidate,
    dim: RelevanceDimensions,
    task: TaskUnderstanding
  ): string {
    const reasons: string[] = [];
    if (dim.taskRelevance >= 0.7) reasons.push(`Direct task keyword/entity match`);
    if (dim.featureRelevance >= 0.8) reasons.push(`Core participant in feature '${task.candidateFeatures[0] ?? 'target'}'`);
    if (dim.changeRelevance >= 0.9) reasons.push(`Modified in working tree`);
    if (dim.verificationRelevance >= 0.8) reasons.push(`Associated with verification failure`);
    if (dim.dependencyRelevance >= 0.8) reasons.push(`Direct structural dependency`);

    return reasons.length > 0 ? reasons.join('; ') : candidate.primaryEvidence;
  }
}
