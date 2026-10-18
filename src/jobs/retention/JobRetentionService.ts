import type Database from 'better-sqlite3';

export interface RetentionPolicyConfig {
  /** Maximum days to retain COMPLETED and CANCELLED jobs (default: 14) */
  readonly completedJobsRetentionDays?: number | undefined;
  /** Maximum days to retain DISPATCHED outbox events (default: 7) */
  readonly dispatchedOutboxRetentionDays?: number | undefined;
  /** Maximum days to retain PROCESSED inbox deduplication records (default: 14) */
  readonly processedInboxRetentionDays?: number | undefined;
  /** Maximum days to retain REPLAYED dead-letter records (default: 30) */
  readonly replayedDeadLetterRetentionDays?: number | undefined;
}

export interface PurgeResult {
  readonly purgedJobsCount: number;
  readonly purgedOutboxCount: number;
  readonly purgedInboxCount: number;
  readonly purgedDeadLetterCount: number;
  readonly executedAt: string;
}

export class JobRetentionService {
  private readonly db: Database.Database;
  private readonly config: Required<RetentionPolicyConfig>;

  constructor(db: Database.Database, config: RetentionPolicyConfig = {}) {
    this.db = db;
    this.config = {
      completedJobsRetentionDays: Math.max(1, config.completedJobsRetentionDays ?? 14),
      dispatchedOutboxRetentionDays: Math.max(1, config.dispatchedOutboxRetentionDays ?? 7),
      processedInboxRetentionDays: Math.max(1, config.processedInboxRetentionDays ?? 14),
      replayedDeadLetterRetentionDays: Math.max(1, config.replayedDeadLetterRetentionDays ?? 30),
    };
  }

  public async purgeExpiredRecords(): Promise<PurgeResult> {
    const now = Date.now();
    const executedAt = new Date(now).toISOString();

    const jobsCutoff = new Date(now - this.config.completedJobsRetentionDays * 86400000).toISOString();
    const outboxCutoff = new Date(now - this.config.dispatchedOutboxRetentionDays * 86400000).toISOString();
    const inboxCutoff = new Date(now - this.config.processedInboxRetentionDays * 86400000).toISOString();
    const dlqCutoff = new Date(now - this.config.replayedDeadLetterRetentionDays * 86400000).toISOString();

    const tx = this.db.transaction(() => {
      // 1. Purge only terminal COMPLETED/CANCELLED jobs older than cutoff.
      // NEVER touch QUEUED, SCHEDULED, RUNNING, or DEAD_LETTERED jobs.
      const purgeJobsStmt = this.db.prepare(`
        DELETE FROM pm_durable_jobs
        WHERE status IN ('COMPLETED', 'CANCELLED')
          AND completed_at IS NOT NULL
          AND completed_at < ?
      `);
      const jobsResult = purgeJobsStmt.run(jobsCutoff);

      // 2. Purge only DISPATCHED outbox events older than cutoff.
      // NEVER touch PENDING or FAILED events.
      const purgeOutboxStmt = this.db.prepare(`
        DELETE FROM pm_event_outbox
        WHERE status = 'DISPATCHED'
          AND dispatched_at IS NOT NULL
          AND dispatched_at < ?
      `);
      const outboxResult = purgeOutboxStmt.run(outboxCutoff);

      // 3. Purge PROCESSED inbox records older than cutoff.
      const purgeInboxStmt = this.db.prepare(`
        DELETE FROM pm_event_inbox
        WHERE status = 'PROCESSED'
          AND processed_at < ?
      `);
      const inboxResult = purgeInboxStmt.run(inboxCutoff);

      // 4. Purge REPLAYED or DISCARDED dead-letter records older than cutoff.
      // NEVER touch PENDING dead-letter records awaiting operator intervention.
      const purgeDlqStmt = this.db.prepare(`
        DELETE FROM pm_job_dead_letter
        WHERE status IN ('REPLAYED', 'DISCARDED')
          AND replayed_at IS NOT NULL
          AND replayed_at < ?
      `);
      const dlqResult = purgeDlqStmt.run(dlqCutoff);

      return {
        purgedJobsCount: jobsResult.changes,
        purgedOutboxCount: outboxResult.changes,
        purgedInboxCount: inboxResult.changes,
        purgedDeadLetterCount: dlqResult.changes,
        executedAt,
      };
    });

    return tx();
  }
}
