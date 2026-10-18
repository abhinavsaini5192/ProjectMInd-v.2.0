import type { VerificationRepositoryState } from '../VerificationRepositoryState.js';
import type { VerificationProvenance } from '../VerificationProvenance.js';

export type TestResultStatus = 'PASSED' | 'FAILED' | 'SKIPPED' | 'BLOCKED' | 'UNKNOWN';

export interface TestVerificationResult {
  readonly testRunId?: string | undefined;
  readonly suite?: string | undefined;
  readonly testName: string;
  readonly status: TestResultStatus;
  readonly duration?: number | undefined;
  readonly failureSummary?: string | undefined;
  readonly resourceReferences?: readonly string[] | undefined;
  readonly featureReferences?: readonly string[] | undefined;
  readonly repositoryState?: VerificationRepositoryState | undefined;
  readonly provenance?: VerificationProvenance | undefined;
}
