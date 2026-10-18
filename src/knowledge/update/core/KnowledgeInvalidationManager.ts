import { randomUUID } from 'crypto';
import type {
  IKnowledgeInvalidationManager,
  InvalidationTargetParams,
} from '../interfaces/IKnowledgeInvalidationManager.js';
import type { IKnowledgeUpdateRepository } from '../interfaces/IKnowledgeUpdateRepository.js';
import type { KnowledgeInvalidation } from '../models/KnowledgeInvalidation.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { KNOWLEDGE_UPDATE_EVENTS } from '../events/KnowledgeUpdateEvents.js';

export class KnowledgeInvalidationManager implements IKnowledgeInvalidationManager {
  constructor(
    private readonly repository: IKnowledgeUpdateRepository,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async invalidate(
    updateId: string,
    repositoryId: string,
    workspaceId: string | undefined,
    targets: readonly InvalidationTargetParams[]
  ): Promise<KnowledgeInvalidation[]> {
    const invalidations: KnowledgeInvalidation[] = [];

    for (const target of targets) {
      const invalidation: KnowledgeInvalidation = {
        invalidationId: randomUUID(),
        updateId,
        repositoryId,
        workspaceId,
        targetType: target.targetType,
        targetId: target.targetId,
        reason: target.reason,
        invalidatedAt: Date.now(),
      };

      await this.repository.saveInvalidation(invalidation);
      invalidations.push(invalidation);

      this.eventBus?.publish(KNOWLEDGE_UPDATE_EVENTS.INVALIDATED, {
        eventName: KNOWLEDGE_UPDATE_EVENTS.INVALIDATED,
        invalidation,
        timestamp: invalidation.invalidatedAt,
      });
    }

    return invalidations;
  }

  public async getInvalidations(updateId: string): Promise<KnowledgeInvalidation[]> {
    return this.repository.getInvalidationsByUpdate(updateId);
  }
}
