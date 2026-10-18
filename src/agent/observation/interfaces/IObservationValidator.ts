import type { ExecutionObservation } from '../models/ExecutionObservation.js';

export interface ScopeValidationParams {
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly taskId?: string | undefined;
}

export interface IObservationValidator {
  validateRawObservation(raw: unknown, scope?: ScopeValidationParams): void;
  validateObservation(observation: ExecutionObservation, scope?: ScopeValidationParams): void;
  validateScope(observation: ExecutionObservation, scope?: ScopeValidationParams): void;
}
