export type RefreshPolicyType =
  | 'NO_REFRESH_REQUIRED'
  | 'INVALIDATE_ONLY'
  | 'REFRESH_ON_NEXT_REQUEST'
  | 'REFRESH_CURRENT_SESSION'
  | 'FORCE_REFRESH'
  | 'BLOCK_UNTIL_REFRESHED';

export interface KnowledgeRefreshDecision {
  readonly decisionId: string;
  readonly updateId: string;
  readonly policy: RefreshPolicyType;
  readonly targetSessionId?: string | undefined;
  readonly targetTaskId?: string | undefined;
  readonly affectedFeatures: readonly string[];
  readonly affectedResources: readonly string[];
  readonly reason: string;
  readonly decidedAt: number;
  readonly metadata?: Record<string, unknown> | undefined;
}
