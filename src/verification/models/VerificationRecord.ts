import type { VerificationType } from './VerificationType.js';
import type { VerificationStatus } from './VerificationStatus.js';
import type { VerificationSource } from './VerificationSource.js';
import type { VerificationProvenance } from './VerificationProvenance.js';
import type { VerificationConfidence } from './VerificationConfidence.js';
import type { VerificationRepositoryState } from './VerificationRepositoryState.js';
import type { VerificationScopeDefinition } from './VerificationScope.js';
import type { VerificationEvidence } from './VerificationEvidence.js';

export interface VerificationRecord {
  readonly verificationId: string;
  readonly taskId?: string | undefined;
  readonly contextSessionId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly verificationType: VerificationType;
  readonly status: VerificationStatus;
  readonly source: VerificationSource;
  readonly provenance: VerificationProvenance;
  readonly confidence: VerificationConfidence;
  readonly repositoryState: VerificationRepositoryState;
  readonly scope: VerificationScopeDefinition;
  readonly startedAt?: string | undefined;
  readonly completedAt?: string | undefined;
  readonly receivedAt: string;
  readonly duration?: number | undefined;
  readonly summary: string;
  readonly diagnostics: readonly string[];
  readonly evidence: VerificationEvidence;
  readonly correlationId?: string | undefined;
  readonly operationId?: string | undefined;
  readonly metadata: Record<string, unknown>;
}
