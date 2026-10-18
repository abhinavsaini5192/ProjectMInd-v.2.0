import type { VerificationPolicy } from '../../../verification/policies/VerificationPolicy.js';

export interface TaskCompletionPolicy {
  readonly requireExecutionReportComplete?: boolean | undefined;
  readonly requireVerificationReport?: boolean | undefined;
  readonly requireTestsPassed?: boolean | undefined;
  readonly requireBuildPassed?: boolean | undefined;
  readonly disallowBlockingErrors?: boolean | undefined;
  readonly disallowCriticallyStaleContext?: boolean | undefined;
  readonly verificationPolicy?: VerificationPolicy | undefined;
  readonly requireTrustedVerification?: boolean | undefined;
  readonly disallowStaleVerification?: boolean | undefined;
  readonly disallowConflictingVerification?: boolean | undefined;
}

export const DEFAULT_TASK_COMPLETION_POLICY: Required<TaskCompletionPolicy> = {
  requireExecutionReportComplete: true,
  requireVerificationReport: true,
  requireTestsPassed: true,
  requireBuildPassed: true,
  disallowBlockingErrors: true,
  disallowCriticallyStaleContext: false,
  verificationPolicy: undefined as any,
  requireTrustedVerification: false,
  disallowStaleVerification: true,
  disallowConflictingVerification: true,
};

