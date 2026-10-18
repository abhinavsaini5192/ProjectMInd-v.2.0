import type { VerificationType } from '../models/VerificationType.js';
import type { VerificationConfidence } from '../models/VerificationConfidence.js';
import type { VerificationScopeType } from '../models/VerificationScope.js';

export interface VerificationPolicy {
  readonly requiredTypes?: readonly VerificationType[] | undefined;
  readonly requireTrustedVerification?: boolean | undefined;
  readonly disallowStale?: boolean | undefined;
  readonly disallowConflicts?: boolean | undefined;
  readonly minimumConfidence?: VerificationConfidence | undefined;
  readonly allowedScopes?: readonly VerificationScopeType[] | undefined;
  readonly allowAgentReportedOnly?: boolean | undefined;
}

export const DEFAULT_VERIFICATION_POLICY: Required<VerificationPolicy> = {
  requiredTypes: ['TEST', 'BUILD'],
  requireTrustedVerification: false,
  disallowStale: true,
  disallowConflicts: true,
  minimumConfidence: 'MEDIUM',
  allowedScopes: ['TASK', 'FEATURE', 'RESOURCE', 'FILE', 'REPOSITORY', 'WORKSPACE'],
  allowAgentReportedOnly: true,
};

export const TASK_TYPE_VERIFICATION_POLICIES: Record<string, VerificationPolicy> = {
  BUG_FIX: {
    requiredTypes: ['TEST', 'BUILD'],
    requireTrustedVerification: false,
    disallowStale: true,
    disallowConflicts: true,
    minimumConfidence: 'HIGH',
    allowAgentReportedOnly: true,
  },
  FEATURE: {
    requiredTypes: ['TEST', 'BUILD', 'TYPECHECK'],
    requireTrustedVerification: false,
    disallowStale: true,
    disallowConflicts: true,
    minimumConfidence: 'MEDIUM',
    allowAgentReportedOnly: true,
  },
  REFACTOR: {
    requiredTypes: ['TEST', 'BUILD', 'TYPECHECK', 'LINT'],
    requireTrustedVerification: false,
    disallowStale: true,
    disallowConflicts: true,
    minimumConfidence: 'HIGH',
    allowAgentReportedOnly: true,
  },
  SECURITY_PATCH: {
    requiredTypes: ['TEST', 'BUILD', 'SECURITY_SCAN'],
    requireTrustedVerification: true,
    disallowStale: true,
    disallowConflicts: true,
    minimumConfidence: 'CONFIRMED',
    allowAgentReportedOnly: false,
  },
  DOCS: {
    requiredTypes: [],
    requireTrustedVerification: false,
    disallowStale: false,
    disallowConflicts: false,
    minimumConfidence: 'LOW',
    allowAgentReportedOnly: true,
  },
};
