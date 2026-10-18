import type { VerificationRecord } from '../models/VerificationRecord.js';
import type { VerificationConflict } from '../models/VerificationConflict.js';
import type { VerificationFreshness } from '../models/VerificationFreshness.js';
import type { RawVerificationInput } from './IVerificationNormalizer.js';
import type { VerificationScopeContext } from './IVerificationValidator.js';

export interface VerificationProcessingResult {
  readonly record: VerificationRecord;
  readonly processed: boolean;
  readonly isDuplicate: boolean;
  readonly conflicts: readonly VerificationConflict[];
  readonly freshness: VerificationFreshness;
}

export interface IVerificationProcessor {
  processVerification(
    input: RawVerificationInput,
    scopeContext?: VerificationScopeContext | undefined
  ): Promise<VerificationProcessingResult>;
}
