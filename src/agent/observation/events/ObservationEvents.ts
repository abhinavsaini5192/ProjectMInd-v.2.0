import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type { ObservationConflict } from '../models/ObservationConflict.js';

export const ObservationEvents = {
  OBSERVATION_RECEIVED: 'agent.observation.received',
  OBSERVATION_NORMALIZED: 'agent.observation.normalized',
  OBSERVATION_CLASSIFIED: 'agent.observation.classified',
  OBSERVATION_CORRELATED: 'agent.observation.correlated',
  OBSERVATION_CONFLICT_DETECTED: 'agent.observation.conflict_detected',
  OBSERVATION_PROCESSED: 'agent.observation.processed',
  OBSERVATION_REJECTED: 'agent.observation.rejected',
  RESOURCES_CHANGED: 'resources_changed',
  CONFLICT_DETECTED: 'observation.conflict_detected',
} as const;

export type ObservationEventType = (typeof ObservationEvents)[keyof typeof ObservationEvents];

export interface ObservationEventPayload {
  readonly observationId: string;
  readonly taskId?: string | undefined;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly agentSessionId?: string | undefined;
  readonly type: string;
  readonly source: string;
  readonly timestamp: string;
  readonly observation?: ExecutionObservation | undefined;
}

export interface ObservationConflictEventPayload {
  readonly conflictId: string;
  readonly taskId: string;
  readonly field: string;
  readonly sources: readonly string[];
  readonly severity: string;
  readonly timestamp: string;
  readonly conflict: ObservationConflict;
}

export interface ObservationRejectedEventPayload {
  readonly rawObservationId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly reason: string;
  readonly timestamp: string;
}
