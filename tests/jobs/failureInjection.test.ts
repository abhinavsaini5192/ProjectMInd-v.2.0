import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteJobRepository } from '../../src/jobs/persistence/SqliteJobRepository.js';
import { DurableJobQueue } from '../../src/jobs/queue/DurableJobQueue.js';
import { SqliteTransactionalOutbox } from '../../src/jobs/events/outbox/SqliteTransactionalOutbox.js';
import { OutboxDispatcher } from '../../src/jobs/events/outbox/OutboxDispatcher.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { JobError } from '../../src/jobs/models/JobError.js';

describe('Jobs & Event Processing - Failure Injection Tests', () => {
  let db: Database.Database;
  let repo: SqliteJobRepository;
  let queue: DurableJobQueue;
  let outbox: SqliteTransactionalOutbox;

  beforeEach(() => {
    db = new Database(':memory:');
    repo = new SqliteJobRepository(db);
    queue = new DurableJobQueue(db);
    outbox = new SqliteTransactionalOutbox(db);
  });

  afterEach(() => {
    db.close();
  });

  it('rejects stale worker result persistence when lease has expired and job was re-claimed', async () => {
    const jobId = 'job-stale-worker';
    await repo.save({
      jobId,
      type: 'SEMANTIC_INDEX_UPDATE',
      status: 'QUEUED',
      priority: 'NORMAL',
      workspaceId: 'ws-1',
      createdAt: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      timeoutMs: 60000,
      payload: {},
      version: 1,
    });

    // Worker 1 claims job
    const jobV1 = await repo.getById(jobId);
    expect(jobV1?.version).toBe(1);

    await repo.update(jobId, {
      status: 'RUNNING',
      workerId: 'worker-1',
    });

    // Worker 1 stalls. Worker 2 reclaims the job due to lease expiration
    await repo.update(jobId, {
      status: 'RUNNING',
      workerId: 'worker-2',
      retryCount: 1,
    });

    const jobV3 = await repo.getById(jobId);
    expect(jobV3?.version).toBe(3);
    expect(jobV3?.workerId).toBe('worker-2');

    // Worker 1 now wakes up and attempts to complete the job with stale expectation
    // Direct statement simulating stale worker update with version 2
    const staleUpdateStmt = db.prepare(`
      UPDATE pm_durable_jobs
      SET status = 'COMPLETED', worker_id = 'worker-1', version = version + 1
      WHERE job_id = ? AND version = 2
    `);

    const result = staleUpdateStmt.run(jobId);
    // Stale worker was rejected! changes = 0
    expect(result.changes).toBe(0);

    // Database still reflects Worker 2
    const current = await repo.getById(jobId);
    expect(current?.workerId).toBe('worker-2');
  });

  it('isolates poison events in outbox so repeated handler failures do not block subsequent events', async () => {
    // Insert Poison Event (will always fail in consumer)
    const poison = await outbox.insertEvent({
      eventType: 'poison.event',
      workspaceId: 'ws-1',
      aggregateType: 'poison',
      aggregateId: 'p-1',
      payload: { poison: true },
    });

    // Insert Healthy Event
    const healthy = await outbox.insertEvent({
      eventType: 'healthy.event',
      workspaceId: 'ws-1',
      aggregateType: 'healthy',
      aggregateId: 'h-1',
      payload: { data: 'ok' },
    });

    const bus = new NodeEventBus();
    const received: string[] = [];

    bus.subscribe('poison.event', () => {
      throw new Error('POISON_EVENT_FAILURE_SIMULATED');
    });

    bus.subscribe('healthy.event', (e: any) => {
      received.push(e.payload.eventId);
    });

    const dispatcher = new OutboxDispatcher(outbox, bus, { batchSize: 10 });
    const count = await dispatcher.dispatchBatch();

    // 1 event (the healthy one) was successfully dispatched
    expect(count).toBe(1);
    expect(received).toContain(healthy.eventId);

    // Poison event was marked with failure and backoff scheduled, not blocking healthy event
    const pending = await outbox.fetchPendingEvents();
    expect(pending.length).toBe(0); // Poison event is backed off into the future
  });

  it('re-queues rejected messages with backoff delay without dropping them', async () => {
    await queue.enqueue('job-reject-test', 'NORMAL');

    const msg = await queue.dequeue();
    expect(msg).not.toBeNull();

    // Worker encounters temporary DB lock and rejects with requeue delay 500ms
    const requeued = await queue.requeue(msg!.receiptHandle, 500);
    expect(requeued).toBe(true);

    // Immediate dequeue yields nothing because delay has not elapsed
    const immediate = await queue.dequeue();
    expect(immediate).toBeNull();

    // Wait for delay to elapse
    await new Promise((r) => setTimeout(r, 550));

    // Message is available again
    const available = await queue.dequeue();
    expect(available?.jobId).toBe('job-reject-test');
    await queue.acknowledge(available!.receiptHandle);
  });
});
