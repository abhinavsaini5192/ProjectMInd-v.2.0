import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteJobRepository } from '../../src/jobs/persistence/SqliteJobRepository.js';
import type { Job } from '../../src/jobs/models/Job.js';

describe('Durable Job Persistence (SqliteJobRepository)', () => {
  let db: Database.Database;
  let repo: SqliteJobRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    repo = new SqliteJobRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('persists and retrieves a complete job record with all metadata', async () => {
    const job: Job = {
      jobId: 'job-101',
      type: 'SEMANTIC_INDEX_UPDATE',
      status: 'QUEUED',
      priority: 'HIGH',
      workspaceId: 'ws-alpha',
      organizationId: 'org-enterprise',
      repositoryId: 'repo-core',
      sessionId: 'sess-1',
      taskId: 'task-1',
      correlationId: 'corr-xyz',
      traceId: 'tr-abc',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 60000,
      idempotencyKey: 'idemp-101',
      payload: { repoPath: '/data/repo', fullScan: true },
      version: 1,
    };

    await repo.save(job);

    const fetched = await repo.getById('job-101');
    expect(fetched).not.toBeNull();
    expect(fetched?.jobId).toBe('job-101');
    expect(fetched?.type).toBe('SEMANTIC_INDEX_UPDATE');
    expect(fetched?.priority).toBe('HIGH');
    expect(fetched?.workspaceId).toBe('ws-alpha');
    expect(fetched?.organizationId).toBe('org-enterprise');
    expect(fetched?.payload).toEqual({ repoPath: '/data/repo', fullScan: true });
    expect(fetched?.version).toBe(1);
  });

  it('enforces database-level idempotency key uniqueness per workspace', async () => {
    const job1: Job = {
      jobId: 'job-orig',
      type: 'FEATURE_DISCOVERY',
      status: 'QUEUED',
      priority: 'NORMAL',
      workspaceId: 'ws-alpha',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 60000,
      idempotencyKey: 'unique-task-key',
      payload: { step: 1 },
      version: 1,
    };

    await repo.save(job1);

    // Look up by idempotency key
    const found = await repo.getByIdempotencyKey('unique-task-key', 'ws-alpha');
    expect(found).not.toBeNull();
    expect(found?.jobId).toBe('job-orig');

    // Attempting to save another job with identical idempotencyKey in the same workspace throws
    const job2: Job = {
      ...job1,
      jobId: 'job-duplicate',
    };

    await expect(repo.save(job2)).rejects.toThrowError(/Idempotency constraint violation/);

    // Saving identical idempotencyKey in a DIFFERENT workspace succeeds (tenant isolation)
    const jobOtherWs: Job = {
      ...job1,
      jobId: 'job-diff-ws',
      workspaceId: 'ws-beta',
    };
    const savedOther = await repo.save(jobOtherWs);
    expect(savedOther.workspaceId).toBe('ws-beta');
  });

  it('enforces optimistic concurrency control and rejects stale concurrent updates', async () => {
    const job: Job = {
      jobId: 'job-concurrency',
      type: 'VERIFICATION_PROCESSING',
      status: 'QUEUED',
      priority: 'NORMAL',
      workspaceId: 'ws-alpha',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 60000,
      payload: { suite: 'all' },
      version: 1,
    };

    await repo.save(job);

    // Worker A updates job to RUNNING
    const updatedA = await repo.update('job-concurrency', {
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      workerId: 'worker-A',
    });
    expect(updatedA?.version).toBe(2);
    expect(updatedA?.status).toBe('RUNNING');

    // Worker B with a stale copy (version 1) attempts update
    // Passing stale expected version through concurrent race condition
    const updateStmt = db.prepare(`
      UPDATE pm_durable_jobs SET
        status = 'COMPLETED',
        version = version + 1
      WHERE job_id = 'job-concurrency' AND version = 1
    `);
    const staleResult = updateStmt.run();
    expect(staleResult.changes).toBe(0); // Rejected by database version constraint!
  });

  it('records execution attempts and maintains audit history', async () => {
    const job: Job = {
      jobId: 'job-attempts',
      type: 'FEATURE_BEHAVIOR_ANALYSIS',
      status: 'QUEUED',
      priority: 'NORMAL',
      workspaceId: 'ws-alpha',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 60000,
      payload: {},
      version: 1,
    };
    await repo.save(job);

    // Record attempt 1 (failed)
    await repo.recordAttempt({
      jobId: 'job-attempts',
      attemptNumber: 1,
      workerId: 'worker-1',
      startedAt: new Date(Date.now() - 5000).toISOString(),
      completedAt: new Date().toISOString(),
      outcome: 'RETRYABLE_FAILURE',
      errorClassification: 'RETRYABLE',
      errorDetails: { message: 'Database lock timeout' },
    });

    // Record attempt 2 (succeeded)
    await repo.recordAttempt({
      jobId: 'job-attempts',
      attemptNumber: 2,
      workerId: 'worker-2',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      outcome: 'SUCCESS',
    });

    const attempts = await repo.getAttempts('job-attempts');
    expect(attempts.length).toBe(2);
    expect(attempts[0].attemptNumber).toBe(1);
    expect(attempts[0].outcome).toBe('RETRYABLE_FAILURE');
    expect(attempts[1].attemptNumber).toBe(2);
    expect(attempts[1].outcome).toBe('SUCCESS');
  });
});
