export type JobErrorCode =
  | 'JOB_NOT_FOUND'
  | 'INVALID_JOB'
  | 'UNKNOWN_JOB_TYPE'
  | 'JOB_ALREADY_RUNNING'
  | 'JOB_ALREADY_COMPLETED'
  | 'JOB_CANCELLED'
  | 'JOB_TIMEOUT'
  | 'JOB_RETRY_EXHAUSTED'
  | 'JOB_AUTHORIZATION_FAILED'
  | 'JOB_SCOPE_INVALID'
  | 'JOB_DEPENDENCY_FAILED'
  | 'JOB_PAYLOAD_INVALID'
  | 'INVALID_PAYLOAD'
  | 'WORKER_UNAVAILABLE'
  | 'QUEUE_UNAVAILABLE'
  | 'QUEUE_CAPACITY_EXCEEDED'
  | 'HANDLER_EXECUTION_FAILED'
  | 'INTERNAL_JOB_ERROR';

export type ErrorCategory = 'RETRYABLE' | 'PERMANENT' | 'OPERATOR_INTERVENTION';

export interface JobErrorDetails {
  readonly code: JobErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly category?: ErrorCategory | undefined;
  readonly details?: Readonly<Record<string, unknown>> | undefined;
  readonly stack?: string | undefined;
}

export class JobError extends Error {
  public readonly code: JobErrorCode;
  public readonly retryable: boolean;
  public readonly category: ErrorCategory;
  public readonly details?: Readonly<Record<string, unknown>> | undefined;

  constructor(
    code: JobErrorCode,
    message: string,
    retryable: boolean = false,
    details?: Record<string, unknown>,
    category?: ErrorCategory
  ) {
    super(message);
    this.name = 'JobError';
    this.code = code;
    this.retryable = retryable;
    this.category = category ?? (retryable ? 'RETRYABLE' : 'PERMANENT');
    this.details = details;
    Object.setPrototypeOf(this, JobError.prototype);
  }

  public toJSON(): JobErrorDetails {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      category: this.category,
      details: this.details,
      stack: this.stack,
    };
  }
}

export function classifyJobError(err: unknown): {
  code: JobErrorCode;
  category: ErrorCategory;
  retryable: boolean;
  message: string;
} {
  if (err instanceof JobError) {
    return {
      code: err.code,
      category: err.category,
      retryable: err.retryable,
      message: err.message,
    };
  }

  const message = err instanceof Error ? err.message : String(err);

  // Operator intervention required
  if (
    message.includes('CORRUPTION') ||
    message.includes('SECURITY') ||
    message.includes('SCHEMA_VIOLATION') ||
    message.includes('FATAL')
  ) {
    return {
      code: 'INTERNAL_JOB_ERROR',
      category: 'OPERATOR_INTERVENTION',
      retryable: false,
      message,
    };
  }

  // Common transient / retryable error signals
  if (
    message.includes('TIMEOUT') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('BUSY') ||
    message.includes('LOCKED') ||
    message.includes('RETRYABLE')
  ) {
    return {
      code: 'HANDLER_EXECUTION_FAILED',
      category: 'RETRYABLE',
      retryable: true,
      message,
    };
  }

  return {
    code: 'HANDLER_EXECUTION_FAILED',
    category: 'PERMANENT',
    retryable: false,
    message,
  };
}
