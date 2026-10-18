import type { VerificationRecord } from '../models/VerificationRecord.js';
import type { VerificationConflict } from '../models/VerificationConflict.js';
import type {
  VerificationSummary,
  VerificationTypeMetrics,
} from '../models/VerificationSummary.js';
import type { VerificationFreshness } from '../models/VerificationFreshness.js';
import type { VerificationType } from '../models/VerificationType.js';
import type { VerificationStatus } from '../models/VerificationStatus.js';

export class VerificationSummaryGenerator {
  public generateSummary(
    records: readonly VerificationRecord[],
    conflicts: readonly VerificationConflict[],
    freshness: VerificationFreshness,
    workspaceId: string = 'default-workspace',
    repositoryId: string = 'default-repo',
    taskId?: string | undefined
  ): VerificationSummary {
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let blocked = 0;
    let unknown = 0;

    const byType: Partial<Record<VerificationType, VerificationTypeMetrics>> = {};

    // Sort descending by completedAt or receivedAt to find latest statuses
    const sorted = [...records].sort((a, b) => {
      const timeA = new Date(a.completedAt ?? a.receivedAt).getTime();
      const timeB = new Date(b.completedAt ?? b.receivedAt).getTime();
      return timeB - timeA;
    });


    for (const record of records) {
      switch (record.status) {
        case 'PASSED':
          passed++;
          break;
        case 'FAILED':
          failed++;
          break;
        case 'SKIPPED':
          skipped++;
          break;
        case 'BLOCKED':
          blocked++;
          break;
        default:
          unknown++;
          break;
      }

      // Group by verification type
      const existingTypeMetrics = byType[record.verificationType] ?? {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        blocked: 0,
        unknown: 0,
        latestStatus: record.status,
      };

      const updatedTypeMetrics: VerificationTypeMetrics = {
        total: existingTypeMetrics.total + 1,
        passed: existingTypeMetrics.passed + (record.status === 'PASSED' ? 1 : 0),
        failed: existingTypeMetrics.failed + (record.status === 'FAILED' ? 1 : 0),
        skipped: existingTypeMetrics.skipped + (record.status === 'SKIPPED' ? 1 : 0),
        blocked: existingTypeMetrics.blocked + (record.status === 'BLOCKED' ? 1 : 0),
        unknown: existingTypeMetrics.unknown + (['PASSED', 'FAILED', 'SKIPPED', 'BLOCKED'].includes(record.status) ? 0 : 1),
        latestStatus: existingTypeMetrics.latestStatus, // set from latest
      };

      byType[record.verificationType] = updatedTypeMetrics;
    }

    // Determine latest statuses
    const latestStatus: VerificationStatus = sorted.length > 0 ? sorted[0]!.status : 'UNKNOWN';

    const latestTrusted = sorted.find(
      (r) =>
        r.provenance.verificationLevel === 'SYSTEM_VERIFIED' ||
        r.provenance.verificationLevel === 'MANUALLY_CONFIRMED'
    );
    const trustedStatus = latestTrusted?.status;

    const latestAgent = sorted.find(
      (r) => r.provenance.verificationLevel === 'AGENT_REPORTED'
    );
    const agentReportedStatus = latestAgent?.status;

    return {
      taskId,
      workspaceId,
      repositoryId,
      total: records.length,
      passed,
      failed,
      skipped,
      blocked,
      unknown,
      latestStatus,
      trustedStatus,
      agentReportedStatus,
      conflicts,
      byType,
      freshness,
      generatedAt: new Date().toISOString(),
    };
  }
}
