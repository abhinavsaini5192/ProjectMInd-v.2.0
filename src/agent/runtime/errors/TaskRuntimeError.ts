import { AgentError } from '../../errors/AgentError.js';

export class TaskRuntimeError extends AgentError {
  constructor(
    message: string,
    code: string = 'TASK_RUNTIME_ERROR',
    details?: Record<string, unknown> | undefined
  ) {
    super(message, code, details);
    this.name = 'TaskRuntimeError';
  }
}

export class TaskNotFoundError extends TaskRuntimeError {
  constructor(public readonly taskId: string) {
    super(`Task '${taskId}' not found`, 'TASK_NOT_FOUND', { taskId });
    this.name = 'TaskNotFoundError';
  }
}

export class TaskVersionConflictError extends TaskRuntimeError {
  constructor(
    public readonly taskId: string,
    public readonly expectedVersion: number,
    public readonly actualVersion: number
  ) {
    super(
      `Task '${taskId}' version conflict: expected version ${expectedVersion}, but actual version is ${actualVersion}`,
      'TASK_VERSION_CONFLICT',
      { taskId, expectedVersion, actualVersion }
    );
    this.name = 'TaskVersionConflictError';
  }
}

export class TaskLifecycleError extends TaskRuntimeError {
  constructor(
    message: string,
    public readonly currentState: string,
    public readonly targetState?: string | undefined
  ) {
    super(message, 'TASK_LIFECYCLE_ERROR', { currentState, targetState });
    this.name = 'TaskLifecycleError';
  }
}

export class TaskScopeError extends TaskRuntimeError {
  constructor(message: string, details?: Record<string, unknown> | undefined) {
    super(message, 'TASK_SCOPE_ERROR', details);
    this.name = 'TaskScopeError';
  }
}

export class TaskLeaseConflictError extends TaskRuntimeError {
  constructor(
    public readonly taskId: string,
    public readonly currentOwner: string,
    public readonly requestingSession: string
  ) {
    super(
      `Task '${taskId}' lease conflict: current lease held by session '${currentOwner}', requested by '${requestingSession}'`,
      'TASK_LEASE_CONFLICT',
      { taskId, currentOwner, requestingSession }
    );
    this.name = 'TaskLeaseConflictError';
  }
}

export class TaskCompletionValidationError extends TaskRuntimeError {
  constructor(
    public readonly taskId: string,
    public readonly missingConditions: readonly string[],
    public readonly reasons: readonly string[]
  ) {
    super(
      `Task '${taskId}' cannot complete. Missing conditions: ${missingConditions.join(', ')}`,
      'TASK_COMPLETION_VALIDATION_ERROR',
      { taskId, missingConditions, reasons }
    );
    this.name = 'TaskCompletionValidationError';
  }
}

export class TaskIdempotencyConflictError extends TaskRuntimeError {
  constructor(
    public readonly operationId: string,
    public readonly existingReportId: string
  ) {
    super(
      `Operation '${operationId}' was already processed with report '${existingReportId}'`,
      'TASK_IDEMPOTENCY_CONFLICT',
      { operationId, existingReportId }
    );
    this.name = 'TaskIdempotencyConflictError';
  }
}
