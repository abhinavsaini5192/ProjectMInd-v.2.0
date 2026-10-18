import type { VerificationRecord } from '../models/VerificationRecord.js';
import type { VerificationFreshness } from '../models/VerificationFreshness.js';
import type { VerificationRepositoryState } from '../models/VerificationRepositoryState.js';

export interface FreshnessEvaluationParams {
  readonly currentRepositoryState?: VerificationRepositoryState | undefined;
  readonly modifiedFiles?: readonly string[] | undefined;
  readonly changedFeatures?: readonly string[] | undefined;
  readonly activeChangeSetId?: string | undefined;
}

export interface IVerificationFreshnessEvaluator {
  evaluateFreshness(
    record: VerificationRecord,
    params?: FreshnessEvaluationParams | undefined
  ): VerificationFreshness;
}
