import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type {
  ObservationConflict,
  ConflictingValueEntry,
  ConflictResolutionStatus,
} from '../models/ObservationConflict.js';
import { SOURCE_PRECEDENCE_RANK } from '../models/ObservationSource.js';

export class ObservationConflictResolver {
  /**
   * Evaluates a new observation against existing task observations to identify and resolve conflicts.
   */
  public detectConflicts(
    newObservation: ExecutionObservation,
    existingObservations: readonly ExecutionObservation[]
  ): readonly ObservationConflict[] {
    const conflicts: ObservationConflict[] = [];

    // Check verification/test outcome conflicts
    if (this.isTestOrVerificationObservation(newObservation)) {
      const relatedExisting = existingObservations.filter(
        (obs) =>
          obs.taskId === newObservation.taskId &&
          this.isTestOrVerificationObservation(obs) &&
          obs.observationId !== newObservation.observationId
      );

      for (const existing of relatedExisting) {
        const conflict = this.evaluateVerificationConflict(newObservation, existing);
        if (conflict) {
          conflicts.push(conflict);
        }
      }
    }

    return conflicts;
  }

  private isTestOrVerificationObservation(obs: ExecutionObservation): boolean {
    return (
      obs.type.startsWith('TEST_') ||
      obs.type.startsWith('BUILD_') ||
      obs.type.startsWith('VERIFICATION_')
    );
  }

  private evaluateVerificationConflict(
    newObs: ExecutionObservation,
    existingObs: ExecutionObservation
  ): ObservationConflict | undefined {
    const newVal = this.extractOutcomeValue(newObs);
    const existingVal = this.extractOutcomeValue(existingObs);

    if (newVal === undefined || existingVal === undefined) return undefined;
    if (newVal === existingVal) return undefined; // No contradiction

    // We have a contradiction! (e.g. PASSED vs FAILED)
    const newRank = SOURCE_PRECEDENCE_RANK[newObs.source];
    const existingRank = SOURCE_PRECEDENCE_RANK[existingObs.source];

    let resolutionStatus: ConflictResolutionStatus = 'UNRESOLVED';
    let resolvedValue: unknown = undefined;
    let resolutionReason: string | undefined = undefined;
    const now = new Date().toISOString();

    if (newObs.source === 'VERIFICATION' || existingObs.source === 'VERIFICATION') {
      resolutionStatus = 'RESOLVED_BY_TRUSTED_SOURCE';
      if (newRank > existingRank) {
        resolvedValue = newVal;
        resolutionReason = `Resolved by trusted verification source '${newObs.source}'`;
      } else {
        resolvedValue = existingVal;
        resolutionReason = `Resolved by trusted verification source '${existingObs.source}'`;
      }
    } else if (newObs.source === existingObs.source) {
      // Same source: newer takes precedence
      const newTime = Date.parse(newObs.timestamp);
      const existingTime = Date.parse(existingObs.timestamp);
      if (newTime >= existingTime) {
        resolutionStatus = 'RESOLVED_BY_NEWER_OBSERVATION';
        resolvedValue = newVal;
        resolutionReason = 'Resolved by newer observation from the same source';
      } else {
        resolutionStatus = 'RESOLVED_BY_NEWER_OBSERVATION';
        resolvedValue = existingVal;
        resolutionReason = 'Preserved existing observation because it has a newer timestamp';
      }
    }

    const valueEntries: ConflictingValueEntry[] = [
      {
        source: existingObs.source,
        value: existingVal,
        observationId: existingObs.observationId,
        reportedAt: existingObs.timestamp,
      },
      {
        source: newObs.source,
        value: newVal,
        observationId: newObs.observationId,
        reportedAt: newObs.timestamp,
      },
    ];

    const conflictId = `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const winnerObservationId =
      resolutionStatus !== 'UNRESOLVED'
        ? (newRank >= existingRank ? newObs.observationId : existingObs.observationId)
        : undefined;

    return {
      conflictId,
      observationIds: [existingObs.observationId, newObs.observationId],
      taskId: newObs.taskId ?? existingObs.taskId ?? 'global',
      field: 'verificationStatus',
      values: valueEntries,
      sources: [existingObs.source, newObs.source],
      severity: resolutionStatus === 'UNRESOLVED' ? 'HIGH' : 'MEDIUM',
      resolutionStatus: resolutionStatus === 'UNRESOLVED' ? 'UNRESOLVED' : 'RESOLVED',
      resolvedValue,
      resolutionReason,
      resolvedAt: resolutionStatus !== 'UNRESOLVED' ? now : undefined,
      existingObservationId: existingObs.observationId,
      conflictingObservationId: newObs.observationId,
      winnerObservationId,
    };
  }

  private extractOutcomeValue(obs: ExecutionObservation): boolean | undefined {
    const payload = (obs.payload as Record<string, unknown>) ?? {};
    if (payload['passed'] !== undefined) {
      return Boolean(payload['passed']);
    }
    if (payload['status'] !== undefined) {
      const s = String(payload['status']).toUpperCase();
      if (s === 'PASSED' || s === 'SUCCESS' || s === 'COMPLETED') return true;
      if (s === 'FAILED' || s === 'FAILURE' || s === 'ERROR') return false;
    }
    if (
      obs.type === 'TEST_COMPLETED' ||
      obs.type === 'BUILD_COMPLETED' ||
      obs.type === 'VERIFICATION_COMPLETED' ||
      obs.type === 'VERIFICATION_PASSED'
    ) {
      return true;
    }
    if (
      obs.type === 'TEST_FAILED' ||
      obs.type === 'BUILD_FAILED' ||
      obs.type === 'VERIFICATION_FAILED'
    ) {
      return false;
    }
    return undefined;
  }
}
