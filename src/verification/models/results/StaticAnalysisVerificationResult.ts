import type { VerificationRepositoryState } from '../VerificationRepositoryState.js';
import type { VerificationProvenance } from '../VerificationProvenance.js';
import type { VerificationStatus } from '../VerificationStatus.js';

export interface StaticAnalysisFinding {
  readonly id?: string | undefined;
  readonly ruleId: string;
  readonly severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  readonly message: string;
  readonly file?: string | undefined;
  readonly line?: number | undefined;
  readonly category?: string | undefined;
}

export interface StaticAnalysisVerificationResult {
  readonly scanner: string;
  readonly status: VerificationStatus;
  readonly findingsCount: number;
  readonly findings: readonly StaticAnalysisFinding[];
  readonly affectedResources?: readonly string[] | undefined;
  readonly repositoryState?: VerificationRepositoryState | undefined;
  readonly provenance?: VerificationProvenance | undefined;
}
