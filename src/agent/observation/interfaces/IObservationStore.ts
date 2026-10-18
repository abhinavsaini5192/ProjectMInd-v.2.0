import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type { ObservationConflict } from '../models/ObservationConflict.js';
import type { ObservationTimelineEntry } from '../models/ObservationTimeline.js';
import type { ObservationSource } from '../models/ObservationSource.js';
import type { ObservationType } from '../models/ObservationType.js';

export interface ObservationQueryFilter {
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly taskId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly type?: ObservationType | undefined;
  readonly source?: ObservationSource | undefined;
  readonly resourcePath?: string | undefined;
  readonly fromTimestamp?: string | undefined;
  readonly toTimestamp?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface IObservationStore {
  saveObservation(observation: ExecutionObservation): Promise<void>;
  getObservation(observationId: string): Promise<ExecutionObservation | undefined>;
  listObservations(filter: ObservationQueryFilter): Promise<readonly ExecutionObservation[]>;
  countObservations(filter: ObservationQueryFilter): Promise<number>;

  // Idempotency & Operation Deduplication
  hasProcessedOperation(operationId: string): Promise<boolean>;
  recordProcessedOperation(operationId: string, observationId: string): Promise<void>;
  getObservationByOperationId(operationId: string): Promise<ExecutionObservation | undefined>;

  // Conflicts
  saveConflict(conflict: ObservationConflict): Promise<void>;
  getConflict(conflictId: string): Promise<ObservationConflict | undefined>;
  listConflicts(taskId: string): Promise<readonly ObservationConflict[]>;

  // Timeline
  recordTimelineEntry(taskId: string, entry: ObservationTimelineEntry): Promise<void>;
  getTimelineEntries(taskId: string): Promise<readonly ObservationTimelineEntry[]>;
}
