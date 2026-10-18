export type FailureCategory =
  | 'TRANSIENT'
  | 'RETRYABLE'
  | 'PERMANENT'
  | 'DEPENDENCY'
  | 'TIMEOUT'
  | 'CONCURRENCY'
  | 'AUTHORIZATION'
  | 'VALIDATION'
  | 'DATA_INTEGRITY'
  | 'RESOURCE_EXHAUSTION'
  | 'CONFIGURATION'
  | 'UNKNOWN';

export type FailureSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface FailureRecord {
  readonly failureId: string;
  readonly category: FailureCategory;
  readonly severity: FailureSeverity;
  readonly errorCode: string;
  readonly message: string;
  readonly operation?: string | undefined;
  readonly resource?: string | undefined;
  readonly timestamp: number;
  readonly retryable: boolean;
  readonly rawError?: unknown | undefined;
  readonly context?: Record<string, unknown> | undefined;
}
