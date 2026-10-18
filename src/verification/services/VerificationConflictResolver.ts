import { randomUUID } from 'crypto';
import type { VerificationRecord } from '../models/VerificationRecord.js';

import type {
  VerificationConflict,
  VerificationConflictSeverity,
} from '../models/VerificationConflict.js';
import type {
  IVerificationConflictResolver,
  ConflictDetectionResult,
} from '../interfaces/IVerificationConflictResolver.js';
import {
  VERIFICATION_LEVEL_PRECEDENCE,
  VERIFICATION_TRUST_PRECEDENCE,
} from '../models/VerificationProvenance.js';

export class VerificationConflictResolver implements IVerificationConflictResolver {
  public detectConflicts(
    newRecord: VerificationRecord,
    existingRecords: readonly VerificationRecord[]
  ): ConflictDetectionResult {
    if (!newRecord.taskId) {
      return { detectedConflicts: [], hasBlockingConflicts: false };
    }

    const detectedConflicts: VerificationConflict[] = [];

    // Filter relevant records for the same task and verification type
    const matchingRecords = existingRecords.filter(
      (r) =>
        r.taskId === newRecord.taskId &&
        r.verificationType === newRecord.verificationType &&
        r.verificationId !== newRecord.verificationId
    );

    for (const existing of matchingRecords) {
      // Check for status conflict (e.g. PASSED vs FAILED)
      const isOpposingStatus =
        (newRecord.status === 'PASSED' && existing.status === 'FAILED') ||
        (newRecord.status === 'FAILED' && existing.status === 'PASSED');

      if (isOpposingStatus) {
        const severity: VerificationConflictSeverity =
          (newRecord.provenance.verificationLevel === 'SYSTEM_VERIFIED' ||
            existing.provenance.verificationLevel === 'SYSTEM_VERIFIED')
            ? 'HIGH'
            : 'MEDIUM';

        // Check if one record is definitively trusted over the other
        const newPrecedence =
          (VERIFICATION_LEVEL_PRECEDENCE[newRecord.provenance.verificationLevel] ?? 0) * 10 +
          (VERIFICATION_TRUST_PRECEDENCE[newRecord.provenance.trustLevel] ?? 0);
        const existingPrecedence =
          (VERIFICATION_LEVEL_PRECEDENCE[existing.provenance.verificationLevel] ?? 0) * 10 +
          (VERIFICATION_TRUST_PRECEDENCE[existing.provenance.trustLevel] ?? 0);

        let resolutionStatus: VerificationConflict['resolutionStatus'] = 'UNRESOLVED';
        let resolvedBy: string | undefined;
        let resolutionReason: string | undefined;
        let resolvedAt: string | undefined;

        if (newPrecedence > existingPrecedence && newRecord.provenance.verificationLevel === 'SYSTEM_VERIFIED') {
          resolutionStatus = 'RESOLVED_BY_TRUSTED_SOURCE';
          resolvedBy = newRecord.source;
          resolutionReason = `Trusted source '${newRecord.source}' (${newRecord.status}) supersedes untrusted report (${existing.status})`;
          resolvedAt = new Date().toISOString();
        } else if (existingPrecedence > newPrecedence && existing.provenance.verificationLevel === 'SYSTEM_VERIFIED') {
          resolutionStatus = 'RESOLVED_BY_TRUSTED_SOURCE';
          resolvedBy = existing.source;
          resolutionReason = `Trusted existing verification from '${existing.source}' (${existing.status}) overrides report from '${newRecord.source}' (${newRecord.status})`;
          resolvedAt = new Date().toISOString();
        }

        const conflict: VerificationConflict = {
          conflictId: `conf_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
          verificationIds: [existing.verificationId, newRecord.verificationId],

          taskId: newRecord.taskId,
          verificationType: newRecord.verificationType,
          conflictingStatuses: [existing.status, newRecord.status],
          sources: [existing.source, newRecord.source],
          severity,
          resolutionStatus,
          resolvedBy,
          resolutionReason,
          createdAt: new Date().toISOString(),
          resolvedAt,
        };

        detectedConflicts.push(conflict);
      }
    }

    const hasBlockingConflicts = detectedConflicts.some(
      (c) => c.resolutionStatus === 'UNRESOLVED'
    );

    return {
      detectedConflicts,
      hasBlockingConflicts,
    };
  }

  public resolveConflict(
    conflict: VerificationConflict,
    records: readonly VerificationRecord[]
  ): VerificationConflict {
    const relatedRecords = records.filter((r) =>
      conflict.verificationIds.includes(r.verificationId)
    );

    if (relatedRecords.length < 2) {
      return conflict;
    }

    const trustedRecord = relatedRecords.find(
      (r) =>
        r.provenance.verificationLevel === 'SYSTEM_VERIFIED' ||
        r.provenance.verificationLevel === 'MANUALLY_CONFIRMED'
    );

    if (trustedRecord) {
      return {
        ...conflict,
        resolutionStatus: 'RESOLVED_BY_TRUSTED_SOURCE',
        resolvedBy: trustedRecord.source,
        resolutionReason: `Resolved by authoritative/trusted source '${trustedRecord.source}' with status ${trustedRecord.status}`,
        resolvedAt: new Date().toISOString(),
      };
    }

    // Sort by timestamp descending
    const sorted = [...relatedRecords].sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );

    return {
      ...conflict,
      resolutionStatus: 'RESOLVED_BY_NEWER_RESULT',
      resolvedBy: sorted[0]!.source,
      resolutionReason: `Resolved by newer verification record received at ${sorted[0]!.receivedAt}`,
      resolvedAt: new Date().toISOString(),
    };
  }
}
