export type RecoveryState =
  | 'NOT_REQUIRED'
  | 'DETECTED'
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'PARTIALLY_RECOVERED'
  | 'RECOVERED'
  | 'FAILED'
  | 'BLOCKED'
  | 'UNKNOWN';

export type RecoveryOperationType =
  | 'STARTUP_RECOVERY'
  | 'JOB_RECOVERY'
  | 'LEASE_RECOVERY'
  | 'KNOWLEDGE_RECONCILIATION'
  | 'CACHE_REBUILD'
  | 'STORAGE_RESTORE'
  | 'DISASTER_RECOVERY';

export interface RecoveryAction {
  readonly actionId: string;
  readonly description: string;
  readonly targetResource: string;
  readonly status: 'PENDING' | 'APPLIED' | 'FAILED' | 'SKIPPED';
  readonly appliedAt?: number | undefined;
  readonly error?: string | undefined;
}

export interface RecoveryVerificationResult {
  readonly isVerified: boolean;
  readonly componentsChecked: readonly string[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly checkedAt: number;
}

export interface RecoveryOperation {
  readonly operationId: string;
  readonly type: RecoveryOperationType;
  readonly scope: string;
  readonly status: RecoveryState;
  readonly startedAt: number;
  readonly completedAt?: number | undefined;
  readonly initiatedBy: string;
  readonly correlationId?: string | undefined;
  readonly recoveryPointId?: string | undefined;
  readonly actions: readonly RecoveryAction[];
  readonly verification?: RecoveryVerificationResult | undefined;
  readonly errors: readonly string[];
}
