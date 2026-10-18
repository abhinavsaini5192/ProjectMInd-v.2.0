import type { ObservationSource } from './ObservationSource.js';

export type ConflictSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ConflictResolutionStatus =
  | 'UNRESOLVED'
  | 'RESOLVED'
  | 'RESOLVED_BY_TRUSTED_SOURCE'
  | 'RESOLVED_BY_NEWER_OBSERVATION'
  | 'RESOLVED_MANUALLY';

export interface ConflictingValueEntry {
  readonly source: ObservationSource;
  readonly value: unknown;
  readonly observationId: string;
  readonly reportedAt: string;
}

export interface ObservationConflict {
  readonly conflictId: string;
  readonly observationIds: readonly string[];
  readonly taskId: string;
  readonly field: string;
  readonly values: readonly ConflictingValueEntry[];
  readonly sources: readonly ObservationSource[];
  readonly severity: ConflictSeverity;
  readonly resolutionStatus: ConflictResolutionStatus;
  readonly resolvedValue?: unknown | undefined;
  readonly resolutionReason?: string | undefined;
  readonly resolvedAt?: string | undefined;

  // Convenient aliases for test & correlation access:
  readonly existingObservationId?: string | undefined;
  readonly conflictingObservationId?: string | undefined;
  readonly winnerObservationId?: string | undefined;
}
