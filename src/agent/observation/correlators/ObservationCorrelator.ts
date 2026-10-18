import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type {
  IObservationCorrelator,
  CorrelationResult,
} from '../interfaces/IObservationCorrelator.js';
import { ObservationConflictResolver } from '../services/ObservationConflictResolver.js';

export class ObservationCorrelator implements IObservationCorrelator {
  constructor(
    private readonly conflictResolver: ObservationConflictResolver = new ObservationConflictResolver()
  ) {}

  public correlate(
    observation: ExecutionObservation,
    existingObservations: readonly ExecutionObservation[]
  ): CorrelationResult {
    const correlatedIds = new Set<string>();

    // 1. Correlate by explicit correlationId or parentObservationId
    if (observation.correlationId) {
      for (const obs of existingObservations) {
        if (obs.correlationId === observation.correlationId || obs.observationId === observation.correlationId) {
          correlatedIds.add(obs.observationId);
        }
      }
    }
    if (observation.parentObservationId) {
      for (const obs of existingObservations) {
        if (obs.observationId === observation.parentObservationId) {
          correlatedIds.add(obs.observationId);
        }
      }
    }

    // 2. Correlate by operationId
    if (observation.operationId) {
      for (const obs of existingObservations) {
        if (obs.operationId === observation.operationId) {
          correlatedIds.add(obs.observationId);
        }
      }
    }

    // 3. Correlate by taskId
    if (observation.taskId) {
      for (const obs of existingObservations) {
        if (obs.taskId === observation.taskId) {
          correlatedIds.add(obs.observationId);
        }
      }
    }

    // 4. Correlate by resource matching
    const currentPaths = this.extractPaths(observation);
    if (currentPaths.length > 0) {
      for (const obs of existingObservations) {
        const otherPaths = this.extractPaths(obs);
        if (currentPaths.some((p) => otherPaths.includes(p))) {
          correlatedIds.add(obs.observationId);
        }
      }
    }

    // Determine ordering status
    const orderingStatus = this.determineOrderingStatus(observation, existingObservations);

    // Detect conflicts
    const detectedConflicts = this.conflictResolver.detectConflicts(observation, existingObservations);
    const conflictDetected = detectedConflicts.length > 0;
    const conflict = conflictDetected ? detectedConflicts[0] : undefined;
    const isOutOfOrder = orderingStatus === 'OUT_OF_ORDER';

    return {
      observation: {
        ...observation,
        orderingStatus,
        ordering: orderingStatus,
        status: 'CORRELATED',
      },
      correlatedObservationIds: Array.from(correlatedIds),
      detectedConflicts,
      orderingStatus,
      conflictDetected,
      conflict,
      isOutOfOrder,
    };
  }

  private determineOrderingStatus(
    observation: ExecutionObservation,
    existingObservations: readonly ExecutionObservation[]
  ): 'ORDERED' | 'OUT_OF_ORDER' | 'DUPLICATE' | 'LATE' | 'UNKNOWN' {
    // Check duplicate operationId
    if (observation.operationId) {
      const duplicate = existingObservations.find(
        (obs) => obs.operationId === observation.operationId && obs.observationId !== observation.observationId
      );
      if (duplicate) return 'DUPLICATE';
    }

    // Check sequence numbers
    if (observation.sequenceNumber !== undefined && existingObservations.length > 0) {
      const maxExistingSeq = Math.max(
        0,
        ...existingObservations
          .map((o) => o.sequenceNumber ?? 0)
          .filter((n) => typeof n === 'number')
      );
      if (observation.sequenceNumber < maxExistingSeq) {
        return 'OUT_OF_ORDER';
      }
    }

    // Check chronological order against existing observations
    const newerObs = existingObservations.find(
      (obs) =>
        obs.taskId === observation.taskId &&
        Date.parse(obs.timestamp) > Date.parse(observation.timestamp)
    );
    if (newerObs) {
      return 'OUT_OF_ORDER';
    }

    // Out of order: TEST_COMPLETED or BUILD_COMPLETED or VERIFICATION_COMPLETED arrived with no matching START event
    if (observation.type === 'TEST_COMPLETED') {
      const hasStart = existingObservations.some(
        (obs) =>
          obs.taskId === observation.taskId &&
          obs.type === 'TEST_STARTED' &&
          Date.parse(obs.timestamp) <= Date.parse(observation.timestamp)
      );
      if (!hasStart && existingObservations.length > 0) {
        return 'OUT_OF_ORDER';
      }
    }

    if (observation.type === 'BUILD_COMPLETED') {
      const hasStart = existingObservations.some(
        (obs) =>
          obs.taskId === observation.taskId &&
          obs.type === 'BUILD_STARTED' &&
          Date.parse(obs.timestamp) <= Date.parse(observation.timestamp)
      );
      if (!hasStart && existingObservations.length > 0) {
        return 'OUT_OF_ORDER';
      }
    }

    // Check if arrived after task completed in existing observations
    const taskCompletedObs = existingObservations.find(
      (obs) => obs.taskId === observation.taskId && obs.type === 'TASK_COMPLETED'
    );
    if (taskCompletedObs && Date.parse(observation.timestamp) > Date.parse(taskCompletedObs.timestamp)) {
      return 'LATE';
    }

    return 'ORDERED';
  }

  private extractPaths(observation: ExecutionObservation): string[] {
    const paths = new Set<string>();
    if (observation.affectedResources) {
      for (const p of observation.affectedResources) paths.add(p);
    }
    const payload = (observation.payload as Record<string, unknown>) ?? {};
    if (typeof payload['path'] === 'string') paths.add(payload['path']);
    if (typeof payload['filePath'] === 'string') paths.add(payload['filePath']);
    if (Array.isArray(payload['modifiedFiles'])) {
      for (const p of payload['modifiedFiles']) {
        if (typeof p === 'string') paths.add(p);
      }
    }
    return Array.from(paths);
  }
}
