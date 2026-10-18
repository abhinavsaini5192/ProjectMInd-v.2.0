export type VerificationScopeType =
  | 'BUILD'
  | 'UNIT_TEST'
  | 'INTEGRATION_TEST'
  | 'LINT'
  | 'SECURITY_SCAN'
  | 'SCHEMA_VALIDATION'
  | 'REGRESSION_SUITE'
  | 'MANUAL_INSPECTION';

export interface TaskVerificationRequirement {
  readonly requiredVerifications?: readonly VerificationScopeType[] | undefined;
  readonly policies?: readonly string[] | undefined;
  readonly requiredEvidence?: readonly string[] | undefined;
  readonly testPatterns?: readonly string[] | undefined;
  readonly minConfidence?: number | undefined;
  readonly blocking?: boolean | undefined;
  readonly requiresHumanApproval?: boolean | undefined;
  readonly approvalGateId?: string | undefined;
}
