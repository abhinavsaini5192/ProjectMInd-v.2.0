import { createHash } from 'node:crypto';
import type { ILearningCandidateGenerator } from '../interfaces/ILearningCandidateGenerator.js';
import type { LearningSignal } from '../models/LearningSignal.js';
import type {
  LearningCandidate,
  CandidateTargetSystem,
  CandidateRiskLevel,
  CandidateReversibility,
} from '../models/LearningCandidate.js';
import type { ILearningStore } from '../interfaces/ILearningStore.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { LearningEventNames } from '../events/LearningEvents.js';

export class LearningCandidateGenerator implements ILearningCandidateGenerator {
  constructor(
    private readonly learningStore?: ILearningStore | undefined,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async generateCandidates(signals: readonly LearningSignal[]): Promise<LearningCandidate[]> {
    const candidates: LearningCandidate[] = [];

    for (const signal of signals) {
      if (signal.direction === 'NO_CHANGE' || signal.direction === 'UNKNOWN') {
        continue;
      }

      const candidate = this.createCandidateFromSignal(signal);
      if (candidate) {
        if (this.learningStore) {
          await this.learningStore.saveCandidate(candidate);
        }
        if (this.eventBus) {
          this.eventBus.publish(LearningEventNames.CANDIDATE_GENERATED, { candidate });
        }
        candidates.push(candidate);
      }
    }

    return candidates;
  }

  private createCandidateFromSignal(signal: LearningSignal): LearningCandidate | null {
    let system: CandidateTargetSystem;
    let candidateType: string;
    let proposedChange: Record<string, any>;
    let expectedEffect: string;
    let risk: CandidateRiskLevel = 'LOW';
    let reversibility: CandidateReversibility = 'FULL';
    const reasoning: string[] = [];

    switch (signal.type) {
      case 'RESOURCE_OMISSION': {
        system = 'CONTEXT';
        candidateType = 'CONTEXT_RESOURCE_BOOST';
        const weightDelta = Math.min(0.25, Math.max(0.10, signal.magnitude * 0.25));
        proposedChange = {
          resourceId: signal.target.targetId,
          weightAdjustment: Math.round(weightDelta * 100) / 100,
          mandatoryInclude: signal.confidence > 0.80,
        };
        expectedEffect = `Increase inclusion probability for omitted resource ${signal.target.targetId} in context packages (${(weightDelta * 100).toFixed(0)}% boost)`;
        reasoning.push(
          `Derived from ${signal.provenance.feedbackCount} omission reports across ${signal.provenance.uniqueSources.length} sources with confidence ${signal.confidence.toFixed(2)}.`
        );
        break;
      }

      case 'RESOURCE_RELEVANCE': {
        system = 'CONTEXT';
        const isBoost = signal.direction === 'POSITIVE' || signal.direction === 'INCREASE';
        candidateType = isBoost ? 'CONTEXT_RESOURCE_BOOST' : 'CONTEXT_RESOURCE_PENALTY';
        const weightDelta = isBoost ? Math.min(0.25, signal.magnitude * 0.25) : -Math.min(0.25, signal.magnitude * 0.25);
        proposedChange = {
          resourceId: signal.target.targetId,
          weightAdjustment: Math.round(weightDelta * 100) / 100,
          mandatoryInclude: isBoost && signal.confidence > 0.85,
        };
        expectedEffect = isBoost
          ? `Increase inclusion probability for ${signal.target.targetId} in context packages (${(weightDelta * 100).toFixed(0)}% boost)`
          : `Reduce inclusion probability for ${signal.target.targetId} in context packages (${(weightDelta * 100).toFixed(0)}% penalty)`;
        reasoning.push(
          `Derived from ${signal.provenance.feedbackCount} observations across ${signal.provenance.uniqueSources.length} sources with confidence ${signal.confidence.toFixed(2)}.`
        );
        break;
      }

      case 'RETRIEVAL_RANKING_ADJUSTMENT': {
        system = 'RETRIEVAL';
        const isBoost = signal.direction === 'POSITIVE' || signal.direction === 'INCREASE';
        candidateType = 'RETRIEVAL_WEIGHT_ADJUSTMENT';
        const rankingBoost = isBoost ? Math.min(0.20, signal.magnitude * 0.20) : -Math.min(0.20, signal.magnitude * 0.20);
        proposedChange = {
          resourceId: signal.target.targetId,
          rankingScoreDelta: Math.round(rankingBoost * 100) / 100,
          minRelevanceScoreOverride: isBoost ? 0.20 : 0.40,
        };
        expectedEffect = `Adjust search ranking weight for resource ${signal.target.targetId} by ${rankingBoost.toFixed(2)}.`;
        reasoning.push(`Search relevance signals indicate resource relevance adjustment of ${rankingBoost.toFixed(2)}.`);
        break;
      }

      case 'TASK_DECOMPOSITION_HEURISTIC': {
        system = 'PLANNING';
        candidateType = 'PLANNING_DECOMPOSITION_HEURISTIC';
        proposedChange = {
          taskPattern: signal.target.targetId,
          recommendation: signal.direction === 'POSITIVE' ? 'PRESERVE_DECOMPOSITION' : 'ADD_VALIDATION_STEP',
          recommendedStep: {
            title: `Verify ${signal.target.targetId} implementation`,
            taskType: 'VERIFICATION',
            priority: 8,
          },
        };
        risk = 'MEDIUM';
        expectedEffect = `Recommend additional validation step during task decomposition for ${signal.target.targetId} tasks.`;
        reasoning.push(`Planning feedback indicated task decomposition improvements for ${signal.target.targetId}.`);
        break;
      }

      case 'AGENT_ROLE_AFFINITY': {
        system = 'COLLABORATION';
        candidateType = 'AGENT_ASSIGNMENT_HEURISTIC';
        proposedChange = {
          targetRoleOrCapability: signal.target.targetId,
          affinityModifier: signal.direction === 'POSITIVE' ? 0.15 : -0.15,
        };
        expectedEffect = `Adjust agent role assignment affinity for ${signal.target.targetId}.`;
        reasoning.push(`Collaboration outcomes demonstrated ${signal.direction} affinity.`);
        break;
      }

      case 'MEMORY_UTILITY':
      case 'MEMORY_STALENESS': {
        system = 'MEMORY';
        const isStale = signal.type === 'MEMORY_STALENESS' || signal.direction === 'NEGATIVE';
        candidateType = isStale ? 'MEMORY_STALENESS_MARKER' : 'MEMORY_RELEVANCE_REINFORCEMENT';
        proposedChange = {
          memoryId: signal.target.targetId,
          action: isStale ? 'FLAG_FOR_DECAY' : 'REINFORCE_UTILITY',
          decayAcceleration: isStale ? 1.5 : 0.8,
        };
        expectedEffect = isStale
          ? `Flag memory ${signal.target.targetId} for review/decay due to low usage or irrelevance.`
          : `Reinforce utility of memory ${signal.target.targetId}.`;
        reasoning.push(`Memory usage feedback observed.`);
        break;
      }

      case 'FEATURE_RESOURCE_ASSOCIATION': {
        system = 'FEATURE';
        candidateType = 'FEATURE_ASSOCIATION_REINFORCEMENT';
        proposedChange = {
          featureId: signal.target.targetId,
          associationScoreDelta: signal.direction === 'POSITIVE' ? 0.15 : -0.15,
        };
        expectedEffect = `Adjust feature-resource association weight for feature ${signal.target.targetId}.`;
        reasoning.push(`Validated feature interactions suggested association update.`);
        break;
      }

      default: {
        system = 'CONTEXT';
        candidateType = 'GENERAL_ADAPTATION';
        proposedChange = { targetId: signal.target.targetId, direction: signal.direction };
        expectedEffect = `General system adaptation for target ${signal.target.targetId}.`;
        reasoning.push(`General learning signal processed.`);
        break;
      }
    }

    const now = Date.now();
    const candidateId = `cand_${now}_${createHash('sha256').update(signal.id + candidateType).digest('hex').slice(0, 8)}`;

    return {
      id: candidateId,
      workspaceId: signal.workspaceId,
      projectId: signal.projectId,
      candidateType,
      target: {
        system,
        targetType: signal.target.targetType,
        targetId: signal.target.targetId,
      },
      proposedChange,
      scope: signal.scope,
      evidence: signal.evidence,
      confidence: signal.confidence,
      authority: signal.provenance.dominantAuthority,
      expectedEffect,
      risk,
      reversibility,
      evaluationStatus: 'PROPOSED',
      deploymentMode: 'SHADOW', // Start in shadow evaluation mode
      reasoning,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
  }
}
