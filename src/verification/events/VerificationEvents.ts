import type { VerificationRecord } from '../models/VerificationRecord.js';
import type { VerificationConflict } from '../models/VerificationConflict.js';
import type { VerificationFreshness } from '../models/VerificationFreshness.js';

export const VerificationEvents = {
  VERIFICATION_RECEIVED: 'verification.received',
  VERIFICATION_NORMALIZED: 'verification.normalized',
  VERIFICATION_VALIDATED: 'verification.validated',
  VERIFICATION_CORRELATED: 'verification.correlated',
  VERIFICATION_COMPLETED: 'verification.completed',
  VERIFICATION_FAILED: 'verification.failed',
  VERIFICATION_BECAME_STALE: 'verification.became_stale',
  VERIFICATION_CONFLICT_DETECTED: 'verification.conflict_detected',
  VERIFICATION_CONFLICT_RESOLVED: 'verification.conflict_resolved',
} as const;

export type VerificationEventType = typeof VerificationEvents[keyof typeof VerificationEvents];

export interface VerificationReceivedPayload {
  readonly verificationId: string;
  readonly taskId?: string | undefined;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly source: string;
  readonly timestamp: string;
}

export interface VerificationNormalizedPayload {
  readonly verificationId: string;
  readonly verificationRecord: VerificationRecord;
  readonly timestamp: string;
}

export interface VerificationValidatedPayload {
  readonly verificationId: string;
  readonly isValid: boolean;
  readonly timestamp: string;
}

export interface VerificationCorrelatedPayload {
  readonly verificationId: string;
  readonly taskId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly timestamp: string;
}

export interface VerificationCompletedPayload {
  readonly verificationId: string;
  readonly taskId?: string | undefined;
  readonly verificationType: string;
  readonly status: string;
  readonly isTrusted: boolean;
  readonly timestamp: string;
  readonly record: VerificationRecord;
}

export interface VerificationFailedPayload {
  readonly verificationId: string;
  readonly taskId?: string | undefined;
  readonly verificationType: string;
  readonly failureSummary?: string | undefined;
  readonly diagnostics: readonly string[];
  readonly timestamp: string;
  readonly record: VerificationRecord;
}

export interface VerificationBecameStalePayload {
  readonly verificationId: string;
  readonly taskId?: string | undefined;
  readonly previousFreshness: string;
  readonly currentFreshness: VerificationFreshness;
  readonly invalidatedBy?: readonly string[] | undefined;
  readonly timestamp: string;
}

export interface VerificationConflictDetectedPayload {
  readonly conflictId: string;
  readonly taskId: string;
  readonly conflict: VerificationConflict;
  readonly timestamp: string;
}

export interface VerificationConflictResolvedPayload {
  readonly conflictId: string;
  readonly taskId: string;
  readonly resolutionStatus: string;
  readonly resolvedBy?: string | undefined;
  readonly timestamp: string;
}
