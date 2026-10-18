import type { VerificationType } from './VerificationType.js';
import type { VerificationStatus } from './VerificationStatus.js';
import type { VerificationLevel } from './VerificationProvenance.js';
import type { VerificationConfidence } from './VerificationConfidence.js';
import type { VerificationFreshnessStatus } from './VerificationFreshness.js';
import type { VerificationScopeDefinition } from './VerificationScope.js';

export interface RequiredVerificationCondition {
  readonly type: VerificationType;
  readonly trustedRequired?: boolean | undefined;
  readonly scope?: VerificationScopeDefinition | undefined;
}

export interface ActualVerificationEvidenceItem {
  readonly verificationId: string;
  readonly type: VerificationType;
  readonly status: VerificationStatus;
  readonly verificationLevel: VerificationLevel;
  readonly freshnessStatus: VerificationFreshnessStatus;
  readonly scope: VerificationScopeDefinition;
  readonly isTrusted: boolean;
  readonly verifiedAt: string;
}

export interface CompletionEvidence {
  readonly taskId: string;
  readonly canComplete: boolean;
  readonly status: 'READY_TO_COMPLETE' | 'NOT_READY' | 'BLOCKED' | 'INVALID';
  readonly requiredConditions: readonly RequiredVerificationCondition[];
  readonly actualEvidence: readonly ActualVerificationEvidenceItem[];
  readonly missingConditions: readonly string[];
  readonly reasons: readonly string[];
  readonly confidence: VerificationConfidence;
  readonly hasConflictingEvidence: boolean;
  readonly hasStaleEvidence: boolean;
  readonly evaluatedAt: string;
}
