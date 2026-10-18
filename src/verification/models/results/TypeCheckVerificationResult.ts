import type { VerificationRepositoryState } from '../VerificationRepositoryState.js';
import type { VerificationProvenance } from '../VerificationProvenance.js';
import type { VerificationStatus } from '../VerificationStatus.js';

export interface TypeCheckDiagnostic {
  readonly file: string;
  readonly line?: number | undefined;
  readonly column?: number | undefined;
  readonly code?: string | number | undefined;
  readonly category: 'ERROR' | 'WARNING' | 'SUGGESTION' | 'MESSAGE';
  readonly message: string;
}

export interface TypeCheckVerificationResult {
  readonly compiler?: string | undefined;
  readonly status: VerificationStatus;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly diagnostics: readonly TypeCheckDiagnostic[];
  readonly affectedResources?: readonly string[] | undefined;
  readonly repositoryState?: VerificationRepositoryState | undefined;
  readonly provenance?: VerificationProvenance | undefined;
}
