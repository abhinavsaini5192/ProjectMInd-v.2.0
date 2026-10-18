export type KnowledgeInvalidationTargetType =
  | 'FEATURE_PROFILE'
  | 'FEATURE_CONTEXT'
  | 'FEATURE_MAPPING'
  | 'FEATURE_DEPENDENCY'
  | 'FEATURE_BEHAVIOR'
  | 'FEATURE_HEALTH'
  | 'FEATURE_RISK'
  | 'FEATURE_IMPACT'
  | 'FEATURE_HISTORY'
  | 'CONTEXT_PACKAGE'
  | 'CONTEXT_PLAN'
  | 'AGENT_CONTEXT_SESSION'
  | 'RESOURCE'
  | 'FEATURE';

export interface KnowledgeInvalidation {
  readonly invalidationId: string;
  readonly updateId: string;
  readonly repositoryId: string;
  readonly workspaceId?: string | undefined;
  readonly targetType: KnowledgeInvalidationTargetType;
  readonly targetId: string;
  readonly reason: string;
  readonly invalidatedAt: number;
  readonly metadata?: Record<string, unknown> | undefined;
}
