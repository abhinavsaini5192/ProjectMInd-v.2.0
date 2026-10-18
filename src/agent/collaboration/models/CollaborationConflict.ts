export type CollaborationConflictType =
  | 'RESOURCE_CONFLICT'
  | 'TASK_CONFLICT'
  | 'FEATURE_CONFLICT'
  | 'API_CONFLICT'
  | 'DATA_CONFLICT'
  | 'CONFIGURATION_CONFLICT'
  | 'DEPENDENCY_CONFLICT'
  | 'OWNERSHIP_CONFLICT'
  | 'CONTEXT_CONFLICT'
  | 'MEMORY_CONFLICT'
  | 'VERIFICATION_CONFLICT'
  | 'UNKNOWN';

export type CollaborationConflictStatus =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'RESOLVED'
  | 'IGNORED'
  | 'ESCALATED';

export type ConflictSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CollaborationConflict {
  readonly conflictId: string;
  readonly collaborationSessionId: string;
  readonly scope: {
    readonly workspaceId: string;
    readonly projectId: string;
    readonly repositoryId?: string | undefined;
  };
  readonly resources: readonly string[];
  readonly participants: readonly string[];
  readonly type: CollaborationConflictType;
  readonly severity: ConflictSeverity;
  readonly description: string;
  readonly detectedAt: number;
  readonly status: CollaborationConflictStatus;
  readonly resolution?: string | undefined;
  readonly resolvedBy?: string | undefined;
  readonly resolvedAt?: number | undefined;
}
