export interface PlanValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly conflicts: readonly string[];
  readonly missingInformation: readonly string[];
  readonly staleReferences: readonly string[];
  readonly securityViolations: readonly string[];
  readonly dependencyIssues: readonly string[];
  readonly verificationIssues: readonly string[];
}
