import type { VerificationRecord } from '../models/VerificationRecord.js';
import type { VerificationSummary } from '../models/VerificationSummary.js';
import type { VerificationTimeline } from '../models/VerificationTimeline.js';
import type { VerificationConflict } from '../models/VerificationConflict.js';
import type { CompletionEvidence } from '../models/CompletionEvidence.js';
import type { VerificationFreshness } from '../models/VerificationFreshness.js';
import type { VerificationType } from '../models/VerificationType.js';
import type { VerificationQueryParams } from './IVerificationStore.js';
import type { FreshnessEvaluationParams } from './IVerificationFreshnessEvaluator.js';
import type { VerificationPolicy } from '../policies/VerificationPolicy.js';

export interface LatestVerificationResult {
  readonly record?: VerificationRecord | undefined;
  readonly freshness?: VerificationFreshness | undefined;
  readonly conflicts: readonly VerificationConflict[];
}

export interface IVerificationQueryService {
  getVerification(verificationId: string): Promise<VerificationRecord | undefined>;
  getVerifications(params: VerificationQueryParams): Promise<VerificationRecord[]>;
  getTaskVerifications(taskId: string): Promise<VerificationRecord[]>;
  getFeatureVerifications(featureId: string): Promise<VerificationRecord[]>;
  getResourceVerifications(resourcePath: string): Promise<VerificationRecord[]>;
  getVerificationSummary(
    taskId: string,
    workspaceId?: string | undefined,
    repositoryId?: string | undefined
  ): Promise<VerificationSummary>;
  getVerificationTimeline(taskId: string): Promise<VerificationTimeline>;
  getVerificationConflicts(taskId?: string | undefined): Promise<VerificationConflict[]>;
  getLatestVerification(
    taskId: string,
    type?: VerificationType | undefined
  ): Promise<LatestVerificationResult>;
  getFreshness(
    verificationId: string,
    currentParams?: FreshnessEvaluationParams | undefined
  ): Promise<VerificationFreshness>;
  getCompletionEvidence(
    taskId: string,
    policy?: VerificationPolicy | undefined,
    currentParams?: FreshnessEvaluationParams | undefined
  ): Promise<CompletionEvidence>;
}
