import type { VerificationType } from './VerificationType.js';
import type { VerificationStatus } from './VerificationStatus.js';
import type { VerificationSource } from './VerificationSource.js';

export type VerificationConflictSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type VerificationConflictResolutionStatus =
  | 'UNRESOLVED'
  | 'RESOLVED_BY_TRUSTED_SOURCE'
  | 'RESOLVED_BY_NEWER_RESULT'
  | 'RESOLVED_MANUALLY'
  | 'SUPERSEDED';

export interface VerificationConflict {
  readonly conflictId: string;
  readonly verificationIds: readonly string[];
  readonly taskId: string;
  readonly verificationType: VerificationType;
  readonly conflictingStatuses: readonly VerificationStatus[];
  readonly sources: readonly VerificationSource[];
  readonly severity: VerificationConflictSeverity;
  readonly resolutionStatus: VerificationConflictResolutionStatus;
  readonly resolvedBy?: string | undefined;
  readonly resolutionReason?: string | undefined;
  readonly createdAt: string;
  readonly resolvedAt?: string | undefined;
}
