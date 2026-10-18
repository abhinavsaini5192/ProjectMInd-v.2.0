import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import Database from 'better-sqlite3';
import { initializeJobDatabaseSchema } from '../../src/jobs/persistence/JobDatabaseSchema.js';
import { SqliteJobRepository } from '../../src/jobs/persistence/SqliteJobRepository.js';
import { DurableJobQueue } from '../../src/jobs/queue/DurableJobQueue.js';
import { JobLeaseManager } from '../../src/jobs/recovery/JobLeaseManager.js';
import { SqliteDeadLetterQueue } from '../../src/jobs/recovery/SqliteDeadLetterQueue.js';
import { JobRecoveryManager } from '../../src/jobs/recovery/JobRecoveryManager.js';
import { SqliteTransactionalOutbox } from '../../src/jobs/events/outbox/SqliteTransactionalOutbox.js';
import { SqliteTransactionalInbox } from '../../src/jobs/events/inbox/SqliteTransactionalInbox.js';

describe('High Availability & Resilience - Durable Jobs, Worker Failures & Event Recovery', () => {
  let tempDir: string;
  let dbPath: string;
  let db: Database.Database;

  let jobRepository: SqliteJobRepository;
  let jobQueue: DurableJobQueue;
  let leaseManager: JobLeaseManager;
  let dlq: SqliteDeadLetterQueue;
  let recoveryManager: JobRecoveryManager;
  let outbox: SqliteTransactionalOutbox;
  let inbox: SqliteTransactionalInbox;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-ha-resilience-test-'));
    dbPath = path.join(tempDir, 'ha_test.db');
    db = new Database(dbPath);
    initializeJobDatabaseSchema(db);

    jobRepository = new SqliteJobRepository(db);
    jobQueue = new DurableJobQueue(db);
    leaseManager = new JobLeaseManager();
    dlq = new SqliteDeadLetterQueue(db);
    recoveryManager = new JobRecoveryManager(leaseManager, jobQueue, dlq, jobRepository);
    outbox = new SqliteTransactionalOutbox(db);
    inbox = new SqliteTransactionalInbox(db);
  });

  afterEach(() => {
    try {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignored
    }
  });

  it('safely recovers running job when worker dies and lease expires (retryable)', async () => {
    // 1. Submit a job and mark RUNNING with lease
    const job = await jobRepository.save({
      jobId: 'job-rec-1',
      type: 'SEMANTIC_INDEX_UPDATE',
      status: 'RUNNING',
      priority: 'NORMAL',
      workspaceId: 'ws-prod',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 300000,
      payload: { target: 'src/' },
      version: 1,
    });

    await leaseManager.acquireLease(job.jobId, 'worker-crashed-1', 50);

    // 2. Wait for lease to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 3. Run recovery sweep
    const { recoveredCount, deadLetteredCount } = await recoveryManager.recoverStaleJobs();

    expect(recoveredCount).toBe(1);
    expect(deadLetteredCount).toBe(0);

    const reloaded = await jobRepository.getById(job.jobId);
    expect(reloaded?.status).toBe('QUEUED');
    expect(reloaded?.retryCount).toBe(1);

    // Job must be re-enqueued into queue
    const polled = await jobQueue.dequeue();
    expect(polled?.jobId).toBe(job.jobId);
  });

  it('dead-letters jobs when worker lease expires and retry count is exhausted', async () => {
    const job = await jobRepository.save({
      jobId: 'job-poison-2',
      type: 'KNOWLEDGE_UPDATE',
      status: 'RUNNING',
      priority: 'NORMAL',
      workspaceId: 'ws-prod',
      createdAt: new Date().toISOString(),
      retryCount: 1, // Already had 1 attempt, maxRetries is 1
      maxRetries: 1,
      timeoutMs: 300000,
      payload: { crash: true },
      version: 1,
    });

    await leaseManager.acquireLease(job.jobId, 'worker-fatal-2', 50);

    // Wait for lease to expire
    await new Promise((resolve) => setTimeout(resolve, 150));

    const { recoveredCount, deadLetteredCount } = await recoveryManager.recoverStaleJobs();

    expect(recoveredCount).toBe(0);
    expect(deadLetteredCount).toBe(1);

    const reloaded = await jobRepository.getById(job.jobId);
    expect(reloaded?.status).toBe('DEAD_LETTERED');
    expect(reloaded?.error?.code).toBe('JOB_RETRY_EXHAUSTED');

    // DLQ record must exist
    const dlqRecord = await dlq.get(job.jobId);
    expect(dlqRecord).toBeDefined();
    expect(dlqRecord?.type).toBe('KNOWLEDGE_UPDATE');
    expect(dlqRecord?.failureReason).toContain('Worker lease expired');
  });

  it('preserves outbox events across storage reconnection and dispatches reliably', async () => {
    // Record transactional events
    const evt = await outbox.insertEvent({
      eventType: 'WORKSPACE_RESTORED',
      workspaceId: 'ws-dr',
      aggregateType: 'Workspace',
      aggregateId: 'ws-dr',
      correlationId: 'corr-dr-1',
      payload: { reason: 'Recovery drill' },
    });

    expect(evt.status).toBe('PENDING');

    // Simulate crash/reconnect by reopening DB connection
    db.close();
    db = new Database(dbPath);
    const reconnectedOutbox = new SqliteTransactionalOutbox(db);

    const pending = await reconnectedOutbox.fetchPendingEvents(10);
    expect(pending).toHaveLength(1);
    expect(pending[0].eventId).toBe(evt.eventId);
    expect(pending[0].eventType).toBe('WORKSPACE_RESTORED');

    // Mark dispatched
    await reconnectedOutbox.markDispatched(evt.eventId);
    const emptyPending = await reconnectedOutbox.fetchPendingEvents(10);
    expect(emptyPending).toHaveLength(0);
  });

  it('guarantees idempotency via inbox deduplication on duplicate delivery', async () => {
    const eventId = 'evt-duplicate-1';
    const consumer = 'SearchIndexer';

    // Before receiving: isProcessed must be false
    const alreadyProcessed1 = await inbox.isProcessed(eventId, consumer);
    expect(alreadyProcessed1).toBe(false);

    // Process event
    await inbox.recordProcessed({
      eventId,
      consumerName: consumer,
      aggregateType: 'Document',
      aggregateId: 'doc-1',
      aggregateSeq: 1,
      status: 'PROCESSED',
    });

    // After receiving: isProcessed must be true
    const alreadyProcessed2 = await inbox.isProcessed(eventId, consumer);
    expect(alreadyProcessed2).toBe(true);
  });
});
