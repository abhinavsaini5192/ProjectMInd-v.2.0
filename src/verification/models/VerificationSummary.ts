import type { VerificationType } from './VerificationType.js';
import type { VerificationStatus } from './VerificationStatus.js';
import type { VerificationConflict } from './VerificationConflict.js';
import type { VerificationFreshness } from './VerificationFreshness.js';

export interface VerificationTypeMetrics {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly blocked: number;
  readonly unknown: number;
  readonly latestStatus: VerificationStatus;
}

export interface VerificationSummary {
  readonly taskId?: string | undefined;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly blocked: number;
  readonly unknown: number;
  readonly latestStatus: VerificationStatus;
  readonly trustedStatus?: VerificationStatus | undefined;
  readonly agentReportedStatus?: VerificationStatus | undefined;
  readonly conflicts: readonly VerificationConflict[];
  readonly byType: Partial<Record<VerificationType, VerificationTypeMetrics>>;
  readonly freshness: VerificationFreshness;
  readonly generatedAt: string;
}
