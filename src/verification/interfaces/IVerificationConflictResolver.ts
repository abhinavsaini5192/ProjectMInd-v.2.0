import type { VerificationRecord } from '../models/VerificationRecord.js';
import type { VerificationConflict } from '../models/VerificationConflict.js';

export interface ConflictDetectionResult {
  readonly detectedConflicts: readonly VerificationConflict[];
  readonly hasBlockingConflicts: boolean;
}

export interface IVerificationConflictResolver {
  detectConflicts(
    newRecord: VerificationRecord,
    existingRecords: readonly VerificationRecord[]
  ): ConflictDetectionResult;

  resolveConflict(
    conflict: VerificationConflict,
    records: readonly VerificationRecord[]
  ): VerificationConflict;
}
