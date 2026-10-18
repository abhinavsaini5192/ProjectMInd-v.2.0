import type { VerificationRepositoryState } from '../VerificationRepositoryState.js';
import type { VerificationProvenance } from '../VerificationProvenance.js';

export type BuildResultStatus = 'PASSED' | 'FAILED' | 'PARTIAL' | 'BLOCKED' | 'UNKNOWN';

export interface BuildVerificationResult {
  readonly buildId?: string | undefined;
  readonly buildTarget?: string | undefined;
  readonly status: BuildResultStatus;
  readonly duration?: number | undefined;
  readonly diagnostics?: readonly string[] | undefined;
  readonly repositoryState?: VerificationRepositoryState | undefined;
  readonly provenance?: VerificationProvenance | undefined;
}
