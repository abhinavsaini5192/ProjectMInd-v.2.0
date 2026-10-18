import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { DurableJobQueue } from '../../src/jobs/queue/DurableJobQueue.js';
import { SqliteDeadLetterQueue } from '../../src/jobs/recovery/SqliteDeadLetterQueue.js';
import { DistributedJobLeaseManager } from '../../src/jobs/recovery/DistributedJobLeaseManager.js';
import { MemoryCoordinationBackend } from '../../src/distributed/coordination/MemoryCoordinationBackend.js';

describe('Durable Queue, Dead Letter & Distributed Lease Management', () => {
  let db: Database.Database;
  let queue: DurableJobQueue;
  let dlq: SqliteDeadLetterQueue;
  let coordBackend: MemoryCoordinationBackend;
  let leaseManager: DistributedJobLeaseManager;

  beforeEach(() => {
    db = new Database(':memory:');
    queue = new DurableJobQueue(db);
    dlq = new SqliteDeadLetterQueue(db);
    coordBackend = new MemoryCoordinationBackend();
    leaseManager = new DistributedJobLeaseManager(coordBackend);
  });

  afterEach(async () => {
    await coordBackend.close();
    db.close();
  });

  describe('DurableJobQueue', () => {
    it('dequeues messages in priority order regardless of insertion sequence', async () => {
      // Enqueue NORMAL, then LOW, then CRITICAL, then HIGH
      await queue.enqueue('job-normal', 'NORMAL');
      await queue.enqueue('job-low', 'LOW');
      await queue.enqueue('job-critical', 'CRITICAL');
      await queue.enqueue('job-high', 'HIGH');

      expect(await queue.getDepth()).toBe(4);

      // Dequeue 1: Must be CRITICAL
      const msg1 = await queue.dequeue();
      expect(msg1?.jobId).toBe('job-critical');
      expect(msg1?.priority).toBe('CRITICAL');
      await queue.acknowledge(msg1!.receiptHandle);

      // Dequeue 2: Must be HIGH
      const msg2 = await queue.dequeue();
      expect(msg2?.jobId).toBe('job-high');
      await queue.acknowledge(msg2!.receiptHandle);

      // Dequeue 3: Must be NORMAL
      const msg3 = await queue.dequeue();
      expect(msg3?.jobId).toBe('job-normal');
      await queue.acknowledge(msg3!.receiptHandle);

      // Dequeue 4: Must be LOW
      const msg4 = await queue.dequeue();
      expect(msg4?.jobId).toBe('job-low');
      await queue.acknowledge(msg4!.receiptHandle);

      expect(await queue.getDepth()).toBe(0);
    });

    it('reclaims expired in-flight messages after visibility timeout expires', async () => {
      await queue.enqueue('job-timeout-test', 'HIGH');

      // Dequeue with short visibility timeout (50ms)
      const msg = await queue.dequeue(50);
      expect(msg).not.toBeNull();
      expect(msg?.deliveryCount).toBe(1);

      // Immediate second dequeue returns null (message is in-flight)
      const empty = await queue.dequeue(50);
      expect(empty).toBeNull();

      // Wait for visibility timeout to elapse
      await new Promise((r) => setTimeout(r, 70));

      // Dequeue again: message has been automatically reclaimed and deliveryCount incremented
      const reclaimed = await queue.dequeue(5000);
      expect(reclaimed).not.toBeNull();
      expect(reclaimed?.jobId).toBe('job-timeout-test');
      expect(reclaimed?.deliveryCount).toBe(2);

      await queue.acknowledge(reclaimed!.receiptHandle);
      expect(await queue.getDepth()).toBe(0);
    });
  });

  describe('SqliteDeadLetterQueue', () => {
    it('records failed jobs and tracks authorized replays with operator audit metadata', async () => {
      await dlq.record({
        jobId: 'job-dlq-1',
        type: 'KNOWLEDGE_UPDATE',
        workspaceId: 'ws-prod',
        failureReason: 'Max retries exhausted: lock timeout',
        errorCode: 'JOB_RETRY_EXHAUSTED',
        retryCount: 3,
        payload: { docId: 'doc-123' },
      });

      expect(await dlq.getDepth()).toBe(1);

      const record = await dlq.get('job-dlq-1');
      expect(record).not.toBeNull();
      expect(record?.jobId).toBe('job-dlq-1');
      expect(record?.errorCode).toBe('JOB_RETRY_EXHAUSTED');

      // Operator triggers replay
      const marked = await dlq.markReplayed('job-dlq-1', 'admin-user-42');
      expect(marked).toBe(true);

      // Pending depth drops to 0
      expect(await dlq.getDepth()).toBe(0);

      // Record can be deleted
      const removed = await dlq.remove('job-dlq-1');
      expect(removed).toBe(true);
    });
  });

  describe('DistributedJobLeaseManager', () => {
    it('coordinates worker leases and prevents concurrent execution across workers', async () => {
      // Worker 1 acquires lease
      const acq1 = await leaseManager.acquireLease('job-lock-1', 'worker-A', 500);
      expect(acq1).toBe(true);

      // Worker 2 attempts acquisition on same job — rejected
      const acq2 = await leaseManager.acquireLease('job-lock-1', 'worker-B', 500);
      expect(acq2).toBe(false);

      // Holder verification
      expect(await leaseManager.getLeaseHolder('job-lock-1')).toBe('worker-A');

      // Worker 1 renews lease
      const renewed = await leaseManager.renewLease('job-lock-1', 'worker-A', 1000);
      expect(renewed).toBe(true);

      // Worker 1 releases lease
      const released = await leaseManager.releaseLease('job-lock-1', 'worker-A');
      expect(released).toBe(true);

      // Now Worker 2 can acquire
      const acq2After = await leaseManager.acquireLease('job-lock-1', 'worker-B', 500);
      expect(acq2After).toBe(true);
      expect(await leaseManager.getLeaseHolder('job-lock-1')).toBe('worker-B');
    });
  });
});
