export type AdapterErrorSeverity = 'CRITICAL' | 'ERROR' | 'WARNING';

export interface AdapterError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly severity: AdapterErrorSeverity;
  readonly requestId?: string | undefined;
  readonly details?: unknown | undefined;
}
