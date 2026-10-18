import type { ExecutionObservation } from './ExecutionObservation.js';
import type { ObservationProvenance } from './ObservationProvenance.js';
import type { ObservationType } from './ObservationType.js';

export type ObservationCausality = 'EXPLICIT' | 'INFERRED' | 'CORRELATED' | 'SEQUENTIAL';

export interface ObservationTimelineEntry {
  readonly entryId: string;
  readonly observationId: string;
  readonly timestamp: string;
  readonly type: ObservationType;
  readonly summary: string;
  readonly provenance: ObservationProvenance | string;
  readonly causality: ObservationCausality;
  readonly affectedResources: readonly string[];
  readonly operationId?: string | undefined;
  readonly parentObservationId?: string | undefined;
  readonly details?: Record<string, unknown> | undefined;
}

export interface ObservationTimeline {
  readonly taskId: string;
  readonly entries: readonly ObservationTimelineEntry[];
  readonly totalEntries: number;
  readonly totalObservations?: number | undefined;
  readonly firstObservedAt?: string | undefined;
  readonly lastObservedAt?: string | undefined;
}
