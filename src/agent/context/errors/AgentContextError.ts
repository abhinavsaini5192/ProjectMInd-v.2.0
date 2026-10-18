export class AgentContextError extends Error {
  public readonly code: string;
  public readonly contextSessionId?: string | undefined;
  public readonly details?: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code = 'AGENT_CONTEXT_ERROR',
    contextSessionId?: string | undefined,
    details?: Record<string, unknown> | undefined
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.contextSessionId = contextSessionId;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ContextVersionConflictError extends AgentContextError {
  public readonly expectedVersion: number;
  public readonly actualVersion: number;

  constructor(
    contextSessionId: string,
    expectedVersion: number,
    actualVersion: number,
    message?: string | undefined
  ) {
    super(
      message ??
        `Context version conflict for session '${contextSessionId}': expected version ${expectedVersion}, but current version is ${actualVersion}`,
      'CONTEXT_VERSION_CONFLICT',
      contextSessionId,
      { expectedVersion, actualVersion }
    );
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

export class ContextSessionNotFoundError extends AgentContextError {
  constructor(contextSessionId: string) {
    super(
      `Context session '${contextSessionId}' was not found`,
      'CONTEXT_SESSION_NOT_FOUND',
      contextSessionId
    );
  }
}

export class ContextDeltaInvalidError extends AgentContextError {
  constructor(contextSessionId: string, reason: string, details?: Record<string, unknown> | undefined) {
    super(
      `Cannot apply context delta for session '${contextSessionId}': ${reason}`,
      'CONTEXT_DELTA_INVALID',
      contextSessionId,
      details
    );
  }
}

export class TaskNotFoundError extends AgentContextError {
  public readonly taskId: string;

  constructor(taskId: string) {
    super(`Agent task '${taskId}' was not found`, 'TASK_NOT_FOUND', undefined, { taskId });
    this.taskId = taskId;
  }
}

export class TaskLifecycleError extends AgentContextError {
  constructor(taskId: string, currentStatus: string, attemptedStatus: string) {
    super(
      `Illegal task transition for task '${taskId}' from '${currentStatus}' to '${attemptedStatus}'`,
      'TASK_LIFECYCLE_INVALID',
      undefined,
      { taskId, currentStatus, attemptedStatus }
    );
  }
}

export class ContextScopeError extends AgentContextError {
  constructor(message: string, details?: Record<string, unknown> | undefined) {
    super(message, 'CONTEXT_SCOPE_VIOLATION', undefined, details);
  }
}

export class ContextPinError extends AgentContextError {
  constructor(message: string, contextSessionId?: string | undefined, details?: Record<string, unknown> | undefined) {
    super(message, 'CONTEXT_PIN_INVALID', contextSessionId, details);
  }
}
