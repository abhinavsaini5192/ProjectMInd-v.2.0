import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { IDeadLetterQueue, DeadLetterRecord } from './IDeadLetterQueue.js';
import { initializeJobDatabaseSchema } from '../persistence/JobDatabaseSchema.js';

export class SqliteDeadLetterQueue implements IDeadLetterQueue {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    initializeJobDatabaseSchema(this.db);
  }

  public async record(entry: Omit<DeadLetterRecord, 'deadLetterId' | 'deadLetteredAt'>): Promise<DeadLetterRecord> {
    const deadLetterId = `dlq-${randomUUID()}`;
    const deadLetteredAt = new Date().toISOString();

    const record: DeadLetterRecord = {
      deadLetterId,
      jobId: entry.jobId,
      type: entry.type,
      workspaceId: entry.workspaceId,
      repositoryId: entry.repositoryId,
      failureReason: entry.failureReason,
      errorCode: entry.errorCode,
      retryCount: entry.retryCount,
      deadLetteredAt,
      correlationId: entry.correlationId,
      payload: entry.payload,
    };

    const stmt = this.db.prepare(`
      INSERT INTO pm_job_dead_letter (
        dead_letter_id, job_id, type, workspace_id, organization_id,
        repository_id, failure_reason, error_code, retry_count,
        payload_json, correlation_id, dead_lettered_at, status
      ) VALUES (
        @dead_letter_id, @job_id, @type, @workspace_id, @organization_id,
        @repository_id, @failure_reason, @error_code, @retry_count,
        @payload_json, @correlation_id, @dead_lettered_at, 'PENDING'
      )
      ON CONFLICT(job_id) DO UPDATE SET
        failure_reason = excluded.failure_reason,
        error_code = excluded.error_code,
        retry_count = excluded.retry_count,
        dead_lettered_at = excluded.dead_lettered_at,
        status = 'PENDING'
    `);

    stmt.run({
      dead_letter_id: deadLetterId,
      job_id: record.jobId,
      type: record.type,
      workspace_id: record.workspaceId,
      organization_id: 'default-org',
      repository_id: record.repositoryId ?? null,
      failure_reason: record.failureReason,
      error_code: record.errorCode,
      retry_count: record.retryCount,
      payload_json: JSON.stringify(record.payload ?? {}),
      correlation_id: record.correlationId ?? null,
      dead_lettered_at: deadLetteredAt,
    });

    return record;
  }

  public async get(jobId: string): Promise<DeadLetterRecord | null> {
    const stmt = this.db.prepare('SELECT * FROM pm_job_dead_letter WHERE job_id = ?');
    const row: any = stmt.get(jobId);
    if (!row) return null;

    return {
      deadLetterId: row.dead_letter_id,
      jobId: row.job_id,
      type: row.type,
      workspaceId: row.workspace_id,
      repositoryId: row.repository_id ?? undefined,
      failureReason: row.failure_reason,
      errorCode: row.error_code,
      retryCount: row.retry_count,
      deadLetteredAt: row.dead_lettered_at,
      correlationId: row.correlation_id ?? undefined,
      payload: JSON.parse(row.payload_json),
    };
  }

  public async list(workspaceId?: string, limit: number = 50): Promise<readonly DeadLetterRecord[]> {
    let stmt;
    if (workspaceId) {
      stmt = this.db.prepare(
        "SELECT * FROM pm_job_dead_letter WHERE workspace_id = ? AND status = 'PENDING' ORDER BY dead_lettered_at DESC LIMIT ?"
      );
      return stmt.all(workspaceId, limit).map(this.mapRow);
    }

    stmt = this.db.prepare(
      "SELECT * FROM pm_job_dead_letter WHERE status = 'PENDING' ORDER BY dead_lettered_at DESC LIMIT ?"
    );
    return stmt.all(limit).map(this.mapRow);
  }

  public async remove(jobId: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM pm_job_dead_letter WHERE job_id = ?');
    const res = stmt.run(jobId);
    return res.changes > 0;
  }

  public async getDepth(): Promise<number> {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM pm_job_dead_letter WHERE status = 'PENDING'");
    const row: any = stmt.get();
    return row?.count ?? 0;
  }

  public async markReplayed(jobId: string, replayedBy: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      UPDATE pm_job_dead_letter
      SET status = 'REPLAYED',
          replayed_at = @now,
          replayed_by = @replayed_by,
          replay_count = replay_count + 1
      WHERE job_id = @job_id
    `);

    const res = stmt.run({
      now: new Date().toISOString(),
      replayed_by: replayedBy,
      job_id: jobId,
    });

    return res.changes > 0;
  }

  private mapRow(row: any): DeadLetterRecord {
    return {
      deadLetterId: row.dead_letter_id,
      jobId: row.job_id,
      type: row.type,
      workspaceId: row.workspace_id,
      repositoryId: row.repository_id ?? undefined,
      failureReason: row.failure_reason,
      errorCode: row.error_code,
      retryCount: row.retry_count,
      deadLetteredAt: row.dead_lettered_at,
      correlationId: row.correlation_id ?? undefined,
      payload: JSON.parse(row.payload_json),
    };
  }

  public async clear(): Promise<void> {
    this.db.exec('DELETE FROM pm_job_dead_letter');
  }
}
