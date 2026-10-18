import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type { ObservationConflict } from '../models/ObservationConflict.js';

export interface CorrelationResult {
  readonly observation: ExecutionObservation;
  readonly correlatedObservationIds: readonly string[];
  readonly detectedConflicts: readonly ObservationConflict[];
  readonly orderingStatus: 'ORDERED' | 'OUT_OF_ORDER' | 'DUPLICATE' | 'LATE' | 'UNKNOWN';

  // Convenience aliases for testing & pipeline:
  readonly conflictDetected?: boolean | undefined;
  readonly conflict?: ObservationConflict | undefined;
  readonly isOutOfOrder?: boolean | undefined;
}

export interface IObservationCorrelator {
  correlate(
    observation: ExecutionObservation,
    existingObservations: readonly ExecutionObservation[]
  ): Promise<CorrelationResult> | CorrelationResult;
}
