import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type { ObservationSource } from '../models/ObservationSource.js';
import type { ScopeValidationParams } from './IObservationValidator.js';

export interface RawObservationInput {
  readonly observationId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly contextSessionId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly source?: ObservationSource | undefined;
  readonly type?: string | undefined;
  readonly timestamp?: string | Date | undefined;
  readonly payload?: unknown | undefined;
  readonly operationId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;

  // Additional descriptive fields:
  readonly summary?: string | undefined;
  readonly category?: string | undefined;
  readonly sequenceNumber?: number | undefined;
  readonly affectedResources?: readonly string[] | undefined;
  readonly parentObservationId?: string | undefined;
}

export interface IObservationNormalizer {
  normalize(input: RawObservationInput, scope?: ScopeValidationParams): ExecutionObservation;
}
