import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { IJobRepository } from './IJobRepository.js';
import type { Job } from '../models/Job.js';
import type { JobStatus } from '../models/JobStatus.js';
import { isValidJobTransition } from '../models/JobStatus.js';
import { JobError } from '../models/JobError.js';
import { initializeJobDatabaseSchema } from './JobDatabaseSchema.js';
import { CorrelationContext } from '../../observability/correlation/CorrelationContext.js';

export interface JobAttemptRecord {
  readonly attemptId: string;
  readonly jobId: string;
  readonly attemptNumber: number;
  readonly workerId: string;
  readonly startedAt: string;
  readonly completedAt?: string | undefined;
  readonly outcome: string;
  readonly errorClassification?: string | undefined;
  readonly errorDetails?: Record<string, unknown> | undefined;
}

export class SqliteJobRepository implements IJobRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    initializeJobDatabaseSchema(this.db);
  }

  private rowToJob(row: any): Job {
    return {
      jobId: row.job_id,
      type: row.type,
      status: row.status,
      priority: row.priority,
      workspaceId: row.workspace_id,
      organizationId: row.organization_id,
      repositoryId: row.repository_id ?? undefined,
      sessionId: row.session_id ?? undefined,
      taskId: row.task_id ?? undefined,
      correlationId: row.correlation_id ?? undefined,
      traceId: row.trace_id ?? undefined,
      createdAt: row.created_at,
      scheduledAt: row.scheduled_at ?? undefined,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      timeoutMs: row.timeout_ms,
      idempotencyKey: row.idempotency_key ?? undefined,
      parentJobId: row.parent_job_id ?? undefined,
      dependencies: row.dependencies_json ? JSON.parse(row.dependencies_json) : undefined,
      payload: JSON.parse(row.payload_json),
      result: row.result_json ? JSON.parse(row.result_json) : undefined,
      error: row.error_json ? JSON.parse(row.error_json) : undefined,
      progress: row.progress_json ? JSON.parse(row.progress_json) : undefined,
      workerId: row.worker_id ?? undefined,
      fencingToken: row.fencing_token ?? 0,
      version: row.version,
    };
  }

  public async save(job: Job): Promise<Job> {
    const ambient = CorrelationContext.current();
    const effectiveCorrelationId = job.correlationId ?? ambient?.correlationId ?? null;
    const effectiveTraceId = job.traceId ?? ambient?.traceId ?? null;

    const stmt = this.db.prepare(`
      INSERT INTO pm_durable_jobs (
        job_id, type, status, priority, workspace_id, organization_id,
        repository_id, session_id, task_id, correlation_id, trace_id,
        created_at, scheduled_at, started_at, completed_at,
        retry_count, max_retries, timeout_ms, idempotency_key,
        parent_job_id, dependencies_json, payload_json, result_json,
        error_json, progress_json, worker_id, fencing_token, version
      ) VALUES (
        @job_id, @type, @status, @priority, @workspace_id, @organization_id,
        @repository_id, @session_id, @task_id, @correlation_id, @trace_id,
        @created_at, @scheduled_at, @started_at, @completed_at,
        @retry_count, @max_retries, @timeout_ms, @idempotency_key,
        @parent_job_id, @dependencies_json, @payload_json, @result_json,
        @error_json, @progress_json, @worker_id, @fencing_token, @version
      )
    `);

    try {
      stmt.run({
        job_id: job.jobId,
        type: job.type,
        status: job.status,
        priority: job.priority,
        workspace_id: job.workspaceId,
        organization_id: job.organizationId ?? 'default-org',
        repository_id: job.repositoryId ?? null,
        session_id: job.sessionId ?? null,
        task_id: job.taskId ?? null,
        correlation_id: effectiveCorrelationId,
        trace_id: effectiveTraceId,
        created_at: job.createdAt,
        scheduled_at: job.scheduledAt ?? null,
        started_at: job.startedAt ?? null,
        completed_at: job.completedAt ?? null,
        retry_count: job.retryCount,
        max_retries: job.maxRetries,
        timeout_ms: job.timeoutMs,
        idempotency_key: job.idempotencyKey ?? null,
        parent_job_id: job.parentJobId ?? null,
        dependencies_json: job.dependencies ? JSON.stringify(job.dependencies) : null,
        payload_json: JSON.stringify(job.payload ?? {}),
        result_json: job.result ? JSON.stringify(job.result) : null,
        error_json: job.error ? JSON.stringify(job.error) : null,
        progress_json: job.progress ? JSON.stringify(job.progress) : null,
        worker_id: job.workerId ?? null,
        fencing_token: job.fencingToken ?? 0,
        version: job.version ?? 1,
      });
      return {
        ...job,
        ...(effectiveCorrelationId ? { correlationId: effectiveCorrelationId } : {}),
        ...(effectiveTraceId ? { traceId: effectiveTraceId } : {}),
      };
    } catch (err: any) {
      if (err.message && err.message.includes('UNIQUE constraint failed')) {
        throw new JobError('JOB_ALREADY_RUNNING', `Idempotency constraint violation for key '${job.idempotencyKey}'`, false);
      }
      throw err;
    }
  }

  public async getById(jobId: string): Promise<Job | null> {
    const stmt = this.db.prepare('SELECT * FROM pm_durable_jobs WHERE job_id = ?');
    const row = stmt.get(jobId);
    return row ? this.rowToJob(row) : null;
  }

  public async getByIdempotencyKey(key: string, workspaceId: string): Promise<Job | null> {
    const stmt = this.db.prepare(
      'SELECT * FROM pm_durable_jobs WHERE idempotency_key = ? AND workspace_id = ?'
    );
    const row = stmt.get(key, workspaceId);
    return row ? this.rowToJob(row) : null;
  }

  public async update(jobId: string, updates: Partial<Job>): Promise<Job | null> {
    const existing = await this.getById(jobId);
    if (!existing) return null;

    if (updates.status && !isValidJobTransition(existing.status, updates.status)) {
      throw new JobError(
        'INVALID_JOB',
        `Invalid job state transition from '${existing.status}' to '${updates.status}'`,
        false
      );
    }

    const merged: Job = {
      ...existing,
      ...updates,
      version: existing.version + 1,
    };

    const stmt = this.db.prepare(`
      UPDATE pm_durable_jobs SET
        status = @status,
        priority = @priority,
        started_at = @started_at,
        completed_at = @completed_at,
        retry_count = @retry_count,
        scheduled_at = @scheduled_at,
        result_json = @result_json,
        error_json = @error_json,
        progress_json = @progress_json,
        worker_id = @worker_id,
        fencing_token = @fencing_token,
        version = @version
      WHERE job_id = @job_id AND version = @expected_version
    `);

    const result = stmt.run({
      job_id: jobId,
      status: merged.status,
      priority: merged.priority,
      started_at: merged.startedAt ?? null,
      completed_at: merged.completedAt ?? null,
      retry_count: merged.retryCount,
      scheduled_at: merged.scheduledAt ?? null,
      result_json: merged.result ? JSON.stringify(merged.result) : null,
      error_json: merged.error ? JSON.stringify(merged.error) : null,
      progress_json: merged.progress ? JSON.stringify(merged.progress) : null,
      worker_id: merged.workerId ?? null,
      fencing_token: merged.fencingToken ?? 0,
      version: merged.version,
      expected_version: existing.version,
    });

    if (result.changes === 0) {
      throw new JobError(
        'INVALID_JOB',
        `Optimistic lock failure: Job '${jobId}' was modified concurrently`,
        true
      );
    }

    return merged;
  }

  public async listByStatus(status: JobStatus, limit: number = 100): Promise<readonly Job[]> {
    const stmt = this.db.prepare('SELECT * FROM pm_durable_jobs WHERE status = ? ORDER BY created_at ASC LIMIT ?');
    const rows = stmt.all(status, limit);
    return rows.map((r) => this.rowToJob(r));
  }

  public async listByWorkspace(workspaceId: string, limit: number = 100): Promise<readonly Job[]> {
    const stmt = this.db.prepare('SELECT * FROM pm_durable_jobs WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?');
    const rows = stmt.all(workspaceId, limit);
    return rows.map((r) => this.rowToJob(r));
  }

  public async delete(jobId: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM pm_durable_jobs WHERE job_id = ?');
    const result = stmt.run(jobId);
    return result.changes > 0;
  }

  public async clear(): Promise<void> {
    this.db.exec('DELETE FROM pm_job_attempts');
    this.db.exec('DELETE FROM pm_durable_jobs');
  }

  public async recordAttempt(entry: {
    jobId: string;
    attemptNumber: number;
    workerId: string;
    startedAt: string;
    completedAt?: string;
    outcome: string;
    errorClassification?: string;
    errorDetails?: Record<string, unknown>;
  }): Promise<JobAttemptRecord> {
    const attemptId = `att-${randomUUID()}`;
    const stmt = this.db.prepare(`
      INSERT INTO pm_job_attempts (
        attempt_id, job_id, attempt_number, worker_id,
        started_at, completed_at, outcome,
        error_classification, error_details_json
      ) VALUES (
        @attempt_id, @job_id, @attempt_number, @worker_id,
        @started_at, @completed_at, @outcome,
        @error_classification, @error_details_json
      )
    `);

    stmt.run({
      attempt_id: attemptId,
      job_id: entry.jobId,
      attempt_number: entry.attemptNumber,
      worker_id: entry.workerId,
      started_at: entry.startedAt,
      completed_at: entry.completedAt ?? null,
      outcome: entry.outcome,
      error_classification: entry.errorClassification ?? null,
      error_details_json: entry.errorDetails ? JSON.stringify(entry.errorDetails) : null,
    });

    return {
      attemptId,
      ...entry,
    };
  }

  public async getAttempts(jobId: string): Promise<readonly JobAttemptRecord[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM pm_job_attempts WHERE job_id = ? ORDER BY attempt_number ASC'
    );
    const rows = stmt.all(jobId);
    return rows.map((r: any) => ({
      attemptId: r.attempt_id,
      jobId: r.job_id,
      attemptNumber: r.attempt_number,
      workerId: r.worker_id,
      startedAt: r.started_at,
      completedAt: r.completed_at ?? undefined,
      outcome: r.outcome,
      errorClassification: r.error_classification ?? undefined,
      errorDetails: r.error_details_json ? JSON.parse(r.error_details_json) : undefined,
    }));
  }
}
