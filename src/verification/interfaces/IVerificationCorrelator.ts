import type { VerificationRecord } from '../models/VerificationRecord.js';

export interface VerificationCorrelationResult {
  readonly correlatedRecord: VerificationRecord;
  readonly correlationStrategy: 'EXPLICIT_TASK' | 'REPORT_ID' | 'OPERATION_ID' | 'REPO_STATE' | 'RESOURCE_MATCH' | 'FEATURE_MATCH' | 'SESSION_PROXIMITY' | 'UNBOUND';
  readonly correlatedTaskId?: string | undefined;
  readonly correlatedSessionId?: string | undefined;
  readonly correlatedResourceIds: readonly string[];
  readonly correlatedFeatureIds: readonly string[];
}

export interface IVerificationCorrelator {
  correlate(
    record: VerificationRecord,
    existingRecords?: readonly VerificationRecord[] | undefined
  ): Promise<VerificationCorrelationResult>;
}
