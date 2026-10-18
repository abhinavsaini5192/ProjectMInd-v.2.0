export type VerificationStatus =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'PARTIAL'
  | 'UNKNOWN';

export type VerificationSource =
  | 'AGENT_REPORTED'
  | 'SYSTEM_VERIFIED'
  | 'INFERRED'
  | 'UNKNOWN';

export interface BuildVerificationDetail {
  readonly status: VerificationStatus;
  readonly details?: string | undefined;
  readonly timestamp?: Date | undefined;
}

export interface TestVerificationDetail {
  readonly status: VerificationStatus;
  readonly total?: number | undefined;
  readonly passed?: number | undefined;
  readonly failed?: number | undefined;
  readonly skipped?: number | undefined;
  readonly details?: readonly Record<string, unknown>[] | undefined;
  readonly timestamp?: Date | undefined;
}

export interface LintVerificationDetail {
  readonly status: VerificationStatus;
  readonly errorCount?: number | undefined;
  readonly warningCount?: number | undefined;
  readonly diagnostics?: readonly string[] | undefined;
  readonly timestamp?: Date | undefined;
}

export interface TypecheckVerificationDetail {
  readonly status: VerificationStatus;
  readonly errorCount?: number | undefined;
  readonly diagnostics?: readonly string[] | undefined;
  readonly timestamp?: Date | undefined;
}

export interface TaskVerificationState {
  readonly verificationState: VerificationStatus;
  readonly verificationSource: VerificationSource;
  readonly lastReportId?: string | undefined;
  readonly build?: BuildVerificationDetail | undefined;
  readonly tests?: TestVerificationDetail | undefined;
  readonly lint?: LintVerificationDetail | undefined;
  readonly typecheck?: TypecheckVerificationDetail | undefined;
  readonly diagnostics: readonly string[];
  readonly summary?: string | undefined;
  readonly updatedAt: Date;
  readonly operationHistory: readonly string[];
}

export function createInitialTaskVerificationState(): TaskVerificationState {
  return {
    verificationState: 'NOT_STARTED',
    verificationSource: 'UNKNOWN',
    diagnostics: [],
    updatedAt: new Date(),
    operationHistory: [],
  };
}
