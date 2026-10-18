import type { VerificationRecord } from '../models/VerificationRecord.js';
import type { VerificationConflict } from '../models/VerificationConflict.js';
import type { VerificationTimelineEntry } from '../models/VerificationTimeline.js';
import type { VerificationType } from '../models/VerificationType.js';
import type { VerificationStatus } from '../models/VerificationStatus.js';
import type { VerificationSource } from '../models/VerificationSource.js';

export interface VerificationQueryParams {
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly contextSessionId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly verificationType?: VerificationType | undefined;
  readonly status?: VerificationStatus | undefined;
  readonly source?: VerificationSource | undefined;
  readonly resourceId?: string | undefined;
  readonly featureId?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface IVerificationStore {
  saveVerification(record: VerificationRecord): Promise<void>;
  getVerification(verificationId: string): Promise<VerificationRecord | undefined>;
  listVerifications(params: VerificationQueryParams): Promise<VerificationRecord[]>;
  getLatestVerification(
    taskId: string,
    type?: VerificationType | undefined
  ): Promise<VerificationRecord | undefined>;
  saveConflict(conflict: VerificationConflict): Promise<void>;
  getConflict(conflictId: string): Promise<VerificationConflict | undefined>;
  listConflicts(taskId?: string | undefined): Promise<VerificationConflict[]>;
  updateConflict(conflict: VerificationConflict): Promise<void>;
  recordProcessedOperation(operationId: string, verificationId: string): Promise<void>;
  hasProcessedOperation(operationId: string): Promise<boolean>;
  getVerificationByOperationId(operationId: string): Promise<VerificationRecord | undefined>;
  recordTimelineEntry(taskId: string, entry: VerificationTimelineEntry): Promise<void>;
  getTimelineEntries(taskId: string): Promise<VerificationTimelineEntry[]>;
}
