import type { VerificationRepositoryState } from '../VerificationRepositoryState.js';
import type { VerificationProvenance } from '../VerificationProvenance.js';
import type { VerificationStatus } from '../VerificationStatus.js';
import type { VerificationScopeDefinition } from '../VerificationScope.js';

export interface SecurityFinding {
  readonly id: string;
  readonly vulnerabilityId?: string | undefined;
  readonly severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  readonly description: string;
  readonly affectedResource?: string | undefined;
  readonly remediation?: string | undefined;
  readonly cve?: string | undefined;
}

export interface SecurityScanResult {
  readonly scanner: string;
  readonly status: VerificationStatus;
  readonly scope: VerificationScopeDefinition;
  readonly findingsSummary: {
    readonly criticalCount: number;
    readonly highCount: number;
    readonly mediumCount: number;
    readonly lowCount: number;
    readonly infoCount: number;
    readonly totalFindings: number;
  };
  readonly findings: readonly SecurityFinding[];
  readonly scannedAt: string;
  readonly repositoryState?: VerificationRepositoryState | undefined;
  readonly provenance?: VerificationProvenance | undefined;
}
