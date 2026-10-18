import type { KnowledgeInvalidation, KnowledgeInvalidationTargetType } from '../models/KnowledgeInvalidation.js';

export interface InvalidationTargetParams {
  readonly targetType: KnowledgeInvalidationTargetType;
  readonly targetId: string;
  readonly reason: string;
}

export interface IKnowledgeInvalidationManager {
  invalidate(
    updateId: string,
    repositoryId: string,
    workspaceId: string | undefined,
    targets: readonly InvalidationTargetParams[]
  ): Promise<KnowledgeInvalidation[]>;

  getInvalidations(updateId: string): Promise<KnowledgeInvalidation[]>;
}
