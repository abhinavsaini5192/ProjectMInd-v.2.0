import type { VerificationType } from './VerificationType.js';
import type { VerificationStatus } from './VerificationStatus.js';
import type { VerificationSource } from './VerificationSource.js';
import type { VerificationProvenance } from './VerificationProvenance.js';
import type { VerificationRepositoryState } from './VerificationRepositoryState.js';

export interface VerificationTimelineEntry {
  readonly entryId: string;
  readonly verificationId: string;
  readonly timestamp: string;
  readonly verificationType: VerificationType;
  readonly status: VerificationStatus;
  readonly source: VerificationSource;
  readonly provenance: VerificationProvenance;
  readonly summary: string;
  readonly repositoryState: VerificationRepositoryState;
  readonly causality: 'EXPLICIT' | 'SEQUENTIAL';
  readonly affectedResources?: readonly string[] | undefined;
  readonly correlationId?: string | undefined;
  readonly operationId?: string | undefined;
}

export interface VerificationTimeline {
  readonly taskId: string;
  readonly entries: readonly VerificationTimelineEntry[];
  readonly totalEntries: number;
  readonly generatedAt: string;
}
