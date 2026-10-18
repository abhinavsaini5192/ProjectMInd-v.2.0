import type { VerificationRepositoryState } from '../VerificationRepositoryState.js';
import type { VerificationProvenance } from '../VerificationProvenance.js';
import type { VerificationStatus } from '../VerificationStatus.js';

export interface LintDiagnostic {
  readonly file: string;
  readonly line?: number | undefined;
  readonly column?: number | undefined;
  readonly ruleId?: string | undefined;
  readonly severity: 'ERROR' | 'WARNING' | 'INFO';
  readonly message: string;
}

export interface LintVerificationResult {
  readonly lintTool?: string | undefined;
  readonly status: VerificationStatus;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly diagnostics: readonly LintDiagnostic[];
  readonly affectedResources?: readonly string[] | undefined;
  readonly repositoryState?: VerificationRepositoryState | undefined;
  readonly provenance?: VerificationProvenance | undefined;
}
