import type { VerificationRecord } from '../../../verification/models/VerificationRecord.js';
import type { VerificationSummary } from '../../../verification/models/VerificationSummary.js';
import type { VerificationTimeline } from '../../../verification/models/VerificationTimeline.js';
import type { CompletionEvidence } from '../../../verification/models/CompletionEvidence.js';
import type { VerificationProcessingResult } from '../../../verification/interfaces/IVerificationProcessor.js';

export interface VerificationSubmitResponse {
  readonly result: VerificationProcessingResult;
}

export interface VerificationRecordResponse {
  readonly record: VerificationRecord;
}

export interface VerificationListResponse {
  readonly verifications: readonly VerificationRecord[];
}

export interface VerificationSummaryResponse {
  readonly summary: VerificationSummary;
}

export interface VerificationTimelineResponse {
  readonly timeline: VerificationTimeline;
}

export interface CompletionEvidenceResponse {
  readonly evidence: CompletionEvidence;
}
