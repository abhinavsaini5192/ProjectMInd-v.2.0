import { AgentError } from '../../errors/AgentError.js';
import type { AgentRuntimeState } from '../models/AgentRuntimeState.js';

export class AgentRuntimeError extends AgentError {
  constructor(
    message: string,
    code: string = 'AGENT_RUNTIME_ERROR',
    details?: Record<string, unknown> | undefined
  ) {
    super(message, code, details);
    this.name = 'AgentRuntimeError';
  }
}

export class RuntimeNotReadyError extends AgentRuntimeError {
  constructor(
    public readonly currentState: AgentRuntimeState,
    operation?: string
  ) {
    super(
      `Agent runtime is not ready (current state: ${currentState})${operation ? ` for operation '${operation}'` : ''}`,
      'RUNTIME_NOT_READY',
      { currentState, operation }
    );
    this.name = 'RuntimeNotReadyError';
  }
}

export class RuntimeStateError extends AgentRuntimeError {
  constructor(
    message: string,
    public readonly fromState: AgentRuntimeState,
    public readonly toState: AgentRuntimeState,
    details?: Record<string, unknown> | undefined
  ) {
    super(message, 'RUNTIME_STATE_ERROR', { fromState, toState, ...details });
    this.name = 'RuntimeStateError';
  }
}

export class RuntimeScopeError extends AgentRuntimeError {
  constructor(
    message: string,
    public readonly tenantScope?: { workspaceId?: string; repositoryId?: string; sessionId?: string; taskId?: string } | undefined
  ) {
    super(message, 'RUNTIME_SCOPE_ERROR', { tenantScope });
    this.name = 'RuntimeScopeError';
  }
}

export class RuntimeRecoveryError extends AgentRuntimeError {
  constructor(
    message: string,
    public readonly checkpointId?: string | undefined,
    details?: Record<string, unknown> | undefined
  ) {
    super(message, 'RUNTIME_RECOVERY_ERROR', { checkpointId, ...details });
    this.name = 'RuntimeRecoveryError';
  }
}

export class RuntimeCapacityError extends AgentRuntimeError {
  constructor(
    message: string,
    public readonly resourceType: 'SESSIONS' | 'TASKS' | 'PAYLOAD_SIZE' | 'CALL_RATE',
    public readonly limit: number,
    public readonly current: number
  ) {
    super(
      `${message}: ${resourceType} limit reached (${current}/${limit})`,
      'RUNTIME_CAPACITY_ERROR',
      { resourceType, limit, current }
    );
    this.name = 'RuntimeCapacityError';
  }
}

export class RuntimeShutdownError extends AgentRuntimeError {
  constructor(message: string, details?: Record<string, unknown> | undefined) {
    super(message, 'RUNTIME_SHUTDOWN_ERROR', details);
    this.name = 'RuntimeShutdownError';
  }
}

export class RuntimeTimeoutError extends AgentRuntimeError {
  constructor(
    public readonly operation: string,
    public readonly timeoutMs: number
  ) {
    super(
      `Runtime operation '${operation}' timed out after ${timeoutMs}ms`,
      'RUNTIME_TIMEOUT_ERROR',
      { operation, timeoutMs }
    );
    this.name = 'RuntimeTimeoutError';
  }
}
