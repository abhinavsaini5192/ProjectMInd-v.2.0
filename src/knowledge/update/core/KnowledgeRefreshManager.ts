import { randomUUID } from 'crypto';
import type { IKnowledgeRefreshManager } from '../interfaces/IKnowledgeRefreshManager.js';
import type { IKnowledgeUpdateRepository } from '../interfaces/IKnowledgeUpdateRepository.js';
import type { KnowledgeRefreshDecision, RefreshPolicyType } from '../models/KnowledgeRefreshDecision.js';
import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';
import type { IAgentContextSessionManager } from '../../../agent/context/interfaces/IAgentContextSessionManager.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { KNOWLEDGE_UPDATE_EVENTS } from '../events/KnowledgeUpdateEvents.js';

export interface KnowledgeRefreshManagerDependencies {
  readonly repository: IKnowledgeUpdateRepository;
  readonly contextSessionManager?: IAgentContextSessionManager | undefined;
  readonly eventBus?: IEventBus | undefined;
}

export class KnowledgeRefreshManager implements IKnowledgeRefreshManager {
  constructor(private readonly deps: KnowledgeRefreshManagerDependencies) {}

  public async determineRefreshPolicy(
    update: KnowledgeUpdate,
    plan: KnowledgeUpdatePlan,
    affectedFeatures: readonly string[],
    affectedResources: readonly string[]
  ): Promise<KnowledgeRefreshDecision> {
    let policy: RefreshPolicyType = 'INVALIDATE_ONLY';
    let reason = 'Targeted feature knowledge invalidated; refresh recommended when next requested.';

    if (affectedFeatures.length === 0 && affectedResources.length === 0) {
      policy = 'NO_REFRESH_REQUIRED';
      reason = 'No active features or resources affected by this update.';
    } else if (update.agentSessionId) {
      policy = 'REFRESH_CURRENT_SESSION';
      reason = `Active agent session '${update.agentSessionId}' context is stale due to modifications in features: [${affectedFeatures.join(', ')}].`;
    } else if (update.taskId) {
      policy = 'REFRESH_ON_NEXT_REQUEST';
      reason = `Task '${update.taskId}' context should be refreshed upon next agent turn.`;
    }

    const decision: KnowledgeRefreshDecision = {
      decisionId: randomUUID(),
      updateId: update.updateId,
      policy,
      targetSessionId: update.agentSessionId,
      targetTaskId: update.taskId,
      affectedFeatures: [...affectedFeatures],
      affectedResources: [...affectedResources],
      reason,
      decidedAt: Date.now(),
    };

    await this.deps.repository.saveRefreshDecision(decision);
    return decision;
  }

  public async applyRefreshDecision(decision: KnowledgeRefreshDecision): Promise<void> {
    if (
      (decision.policy === 'REFRESH_CURRENT_SESSION' || decision.policy === 'FORCE_REFRESH') &&
      this.deps.contextSessionManager &&
      decision.targetSessionId
    ) {
      try {
        await this.deps.contextSessionManager.markContextStale(
          decision.targetSessionId,
          'FEATURE_CHANGED'
        );
      } catch {
        // Ignore session stale marking failure if session has ended or not found
      }
    }

    this.deps.eventBus?.publish(KNOWLEDGE_UPDATE_EVENTS.REFRESH_REQUESTED, {
      eventName: KNOWLEDGE_UPDATE_EVENTS.REFRESH_REQUESTED,
      refreshDecision: decision,
      timestamp: decision.decidedAt,
    });
  }
}
