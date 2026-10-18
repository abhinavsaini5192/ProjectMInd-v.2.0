import { createHash } from 'node:crypto';
import type { ILearningSignalExtractor } from '../interfaces/ILearningSignalExtractor.js';
import type { Feedback } from '../models/Feedback.js';
import type {
  LearningSignal,
  LearningSignalType,
  SignalDirection,
  LearningEvidence,
} from '../models/LearningSignal.js';
import type { LearningAuthority } from '../models/LearningAuthority.js';
import { AUTHORITY_PRECEDENCE } from '../models/LearningAuthority.js';
import type { ILearningStore } from '../interfaces/ILearningStore.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { LearningEventNames } from '../events/LearningEvents.js';

export class LearningSignalExtractor implements ILearningSignalExtractor {
  constructor(
    private readonly learningStore?: ILearningStore | undefined,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async extractSignals(feedbackItems: readonly Feedback[]): Promise<LearningSignal[]> {
    if (feedbackItems.length === 0) return [];

    // 1. Group feedback items by target and scope
    const groups = new Map<string, Feedback[]>();
    for (const fb of feedbackItems) {
      const key = `${fb.workspaceId}:${fb.projectId}:${fb.targetType}:${fb.targetId}:${fb.scope.level}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(fb);
    }

    const signals: LearningSignal[] = [];

    // 2. Process each group
    for (const [, items] of groups) {
      if (items.length === 0) continue;

      const first = items[0]!;
      const target = { targetType: first.targetType, targetId: first.targetId };
      const scope = first.scope;
      const workspaceId = first.workspaceId;
      const projectId = first.projectId;

      // Evidence list
      const evidenceList: LearningEvidence[] = items.map((item, idx) => ({
        evidenceId: `ev_${item.id}_${idx}`,
        feedbackId: item.id,
        sourceType: item.sourceType,
        description: `Feedback ${item.feedbackType} with value ${item.value.toFixed(2)}`,
        value: item.value,
        confidence: item.confidence,
        timestamp: item.timestamp,
        authority: item.provenance.authority,
        referenceUri: item.contextReference ?? item.taskReference,
        verificationPassed: item.provenance.verificationPassed,
      }));

      // Calculate aggregated metrics
      const uniqueSources = Array.from(new Set(items.map((i) => `${i.sourceType}:${i.sourceId}`)));
      let positiveCount = 0;
      let negativeCount = 0;
      let totalWeightedValue = 0;
      let totalWeight = 0;
      let maxAuthority: LearningAuthority = 'OBSERVED';
      let maxAuthorityRank = 0;

      for (const item of items) {
        const authRank = AUTHORITY_PRECEDENCE[item.provenance.authority] ?? 10;
        if (authRank > maxAuthorityRank) {
          maxAuthorityRank = authRank;
          maxAuthority = item.provenance.authority;
        }

        const weight = (authRank / 100) * (item.provenance.isExplicit ? 1.5 : 1.0) * item.confidence;
        totalWeightedValue += item.value * weight;
        totalWeight += weight;

        if (item.value > 0) positiveCount++;
        else if (item.value < 0) negativeCount++;
      }

      const meanValue = totalWeight > 0 ? totalWeightedValue / totalWeight : 0;

      // Conflict detection: both positive and negative evidence present
      const hasConflict = positiveCount > 0 && negativeCount > 0;
      if (hasConflict && this.learningStore) {
        const positiveFb = items.find((i) => i.value > 0);
        const negativeFb = items.find((i) => i.value < 0);
        if (positiveFb && negativeFb) {
          const conflict = {
            id: `conf_${Date.now()}_${target.targetId.slice(0, 8)}`,
            targetType: target.targetType,
            targetId: target.targetId,
            feedbackAId: positiveFb.id,
            feedbackBId: negativeFb.id,
            claimA: `${positiveFb.sourceType} rated ${positiveFb.feedbackType} (${positiveFb.value})`,
            claimB: `${negativeFb.sourceType} rated ${negativeFb.feedbackType} (${negativeFb.value})`,
            conflictType: 'CONTRADICTORY_EVALUATION' as const,
            detectedAt: Date.now(),
            resolution: `Evaluate task context: positive for ${positiveFb.taskReference ?? 'task'}, negative for ${negativeFb.taskReference ?? 'task'}`,
          };
          await this.learningStore.saveConflict(conflict);
          if (this.eventBus) {
            this.eventBus.publish(LearningEventNames.CONFLICT_DETECTED, { conflict });
          }
        }
      }

      // Determine signal direction
      let direction: SignalDirection = 'NO_CHANGE';
      if (meanValue >= 0.2) {
        direction = meanValue >= 0.6 ? 'POSITIVE' : 'INCREASE';
      } else if (meanValue <= -0.2) {
        direction = meanValue <= -0.6 ? 'NEGATIVE' : 'DECREASE';
      }

      // Signal magnitude clamped to [0.0, 1.0]
      const magnitude = Math.min(1.0, Math.max(0.0, Math.abs(meanValue)));

      // Confidence computation accounting for count, diversity, and conflicts
      const countFactor = Math.min(1.0, items.length / 5);
      const diversityFactor = Math.min(1.0, uniqueSources.length / 3);
      const conflictPenalty = hasConflict ? 0.3 : 1.0;
      const authorityFactor = maxAuthorityRank / 100;

      const confidence = Math.min(
        1.0,
        Math.max(0.1, (countFactor * 0.3 + diversityFactor * 0.3 + authorityFactor * 0.4) * conflictPenalty)
      );

      // Determine Signal Type
      const signalType = this.determineSignalType(first.targetType, first.feedbackType);

      const signalId = `sig_${Date.now()}_${createHash('sha256').update(target.targetId + items.length).digest('hex').slice(0, 8)}`;

      const signal: LearningSignal = {
        id: signalId,
        workspaceId,
        projectId,
        type: signalType,
        target,
        scope,
        direction,
        magnitude,
        confidence,
        evidence: evidenceList,
        provenance: {
          feedbackCount: items.length,
          uniqueSources,
          dominantAuthority: maxAuthority,
          isAggregated: items.length > 1,
          generatedBy: 'LearningSignalExtractor',
        },
        createdAt: Date.now(),
      };

      if (this.learningStore) {
        await this.learningStore.saveSignal(signal);
      }
      if (this.eventBus) {
        this.eventBus.publish(LearningEventNames.SIGNAL_EXTRACTED, { signal });
      }

      signals.push(signal);
    }

    return signals;
  }

  private determineSignalType(targetType: string, feedbackType: string): LearningSignalType {
    if (feedbackType === 'CONTEXT_MISSING') return 'RESOURCE_OMISSION';
    if (feedbackType.startsWith('RETRIEVAL_')) return 'RETRIEVAL_RANKING_ADJUSTMENT';
    if (feedbackType.startsWith('PLAN_') || feedbackType.startsWith('TASK_DECOMPOSE')) {
      return 'TASK_DECOMPOSITION_HEURISTIC';
    }
    if (feedbackType.startsWith('TASK_PRIORITY')) return 'TASK_PRIORITY_ADJUSTMENT';
    if (feedbackType.startsWith('AGENT_') || feedbackType.startsWith('TASK_ASSIGNMENT')) {
      return 'AGENT_ROLE_AFFINITY';
    }
    if (feedbackType.startsWith('VERIFICATION_')) return 'VERIFICATION_REQUIREMENT';
    if (feedbackType.startsWith('FEATURE_')) return 'FEATURE_RESOURCE_ASSOCIATION';
    if (feedbackType === 'MEMORY_USEFUL') return 'MEMORY_UTILITY';
    if (feedbackType === 'MEMORY_IRRELEVANT') return 'MEMORY_STALENESS';
    if (feedbackType === 'USER_CORRECTION' || feedbackType === 'ERROR_CORRECTED') {
      return 'GENERAL_CORRECTION';
    }
    return 'RESOURCE_RELEVANCE';
  }
}
