import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { TenantIsolationGuard } from '../../src/jobs/security/TenantIsolationGuard.js';
import { JobRetentionService } from '../../src/jobs/retention/JobRetentionService.js';
import { SqliteJobRepository } from '../../src/jobs/persistence/SqliteJobRepository.js';
import { SqliteTransactionalOutbox } from '../../src/jobs/events/outbox/SqliteTransactionalOutbox.js';
import { SqliteDeadLetterQueue } from '../../src/jobs/recovery/SqliteDeadLetterQueue.js';
import { SqliteTransactionalInbox } from '../../src/jobs/events/inbox/SqliteTransactionalInbox.js';

describe('Tenant Isolation Guard & Safe Retention Service', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  describe('TenantIsolationGuard', () => {
    it('blocks cross-workspace job access', () => {
      expect(() => {
        TenantIsolationGuard.assertWorkspaceAccess('workspace-A', 'workspace-B');
      }).toThrowError(/Access denied: Target workspace 'workspace-A' does not match caller workspace 'workspace-B'/);

      expect(() => {
        TenantIsolationGuard.assertWorkspaceAccess('workspace-A', 'workspace-A');
      }).not.toThrow();
    });

    it('blocks cross-organization tenant access', () => {
      expect(() => {
        TenantIsolationGuard.assertOrganizationAccess('org-enterprise', 'org-competitor');
      }).toThrowError(/Access denied: Cross-organization access between 'org-enterprise' and 'org-competitor' is prohibited/);
    });

    it('enforces maximum payload size limit and prevents memory exhaustion', () => {
      // 100 KB payload -> OK
      const normalPayload = { data: 'x'.repeat(100 * 1024) };
      expect(() => TenantIsolationGuard.assertPayloadSafe(normalPayload)).not.toThrow();

      // 600 KB payload -> Exceeds 512KB cap
      const excessivePayload = { data: 'x'.repeat(600 * 1024) };
      expect(() => TenantIsolationGuard.assertPayloadSafe(excessivePayload)).toThrowError(
        /Payload size .* exceeds maximum allowable limit/
      );
    });

    it('detects and rejects dangerous prototype pollution and shell execution patterns', () => {
      expect(() => {
        TenantIsolationGuard.assertPayloadSafe({ command: 'echo hi; /bin/sh -i' });
      }).toThrowError(/Payload contains prohibited executable or prototype pollution patterns/);

      expect(() => {
        TenantIsolationGuard.assertPayloadSafe(JSON.parse('{"__proto__": {"isAdmin": true}}'));
      }).toThrowError(/Payload contains prohibited executable or prototype pollution patterns/);
    });
  });

  describe('JobRetentionService', () => {
    it('purges only terminal records older than cutoff without touching active or replayable work', async () => {
      const repo = new SqliteJobRepository(db);
      const outbox = new SqliteTransactionalOutbox(db);
      const dlq = new SqliteDeadLetterQueue(db);
      const inbox = new SqliteTransactionalInbox(db);

      const oldTimestamp = new Date(Date.now() - 30 * 86400000).toISOString(); // 30 days ago
      const recentTimestamp = new Date(Date.now() - 1 * 86400000).toISOString(); // 1 day ago

      // 1. Jobs:
      // Old completed job -> SHOULD BE PURGED
      await repo.save({
        jobId: 'job-old-completed',
        type: 'SEMANTIC_INDEX_UPDATE',
        status: 'COMPLETED',
        priority: 'NORMAL',
        workspaceId: 'ws-1',
        createdAt: oldTimestamp,
        completedAt: oldTimestamp,
        retryCount: 0,
        maxRetries: 3,
        timeoutMs: 60000,
        payload: {},
        version: 1,
      });

      // Recent completed job -> SHOULD BE KEPT
      await repo.save({
        jobId: 'job-recent-completed',
        type: 'SEMANTIC_INDEX_UPDATE',
        status: 'COMPLETED',
        priority: 'NORMAL',
        workspaceId: 'ws-1',
        createdAt: recentTimestamp,
        completedAt: recentTimestamp,
        retryCount: 0,
        maxRetries: 3,
        timeoutMs: 60000,
        payload: {},
        version: 1,
      });

      // Old QUEUED job -> MUST BE PROTECTED (NOT PURGED)
      await repo.save({
        jobId: 'job-old-queued',
        type: 'SEMANTIC_INDEX_UPDATE',
        status: 'QUEUED',
        priority: 'NORMAL',
        workspaceId: 'ws-1',
        createdAt: oldTimestamp,
        retryCount: 0,
        maxRetries: 3,
        timeoutMs: 60000,
        payload: {},
        version: 1,
      });

      // 2. Outbox:
      // Old dispatched outbox event -> SHOULD BE PURGED
      const evOld = await outbox.insertEvent({
        eventType: 'test.event',
        workspaceId: 'ws-1',
        aggregateType: 'test',
        aggregateId: 'test-1',
        payload: {},
      });
      db.prepare("UPDATE pm_event_outbox SET status = 'DISPATCHED', dispatched_at = ? WHERE event_id = ?").run(
        oldTimestamp,
        evOld.eventId
      );

      // Old PENDING outbox event -> MUST BE PROTECTED (NOT PURGED)
      const evPending = await outbox.insertEvent({
        eventType: 'test.pending',
        workspaceId: 'ws-1',
        aggregateType: 'test',
        aggregateId: 'test-2',
        payload: {},
      });
      db.prepare('UPDATE pm_event_outbox SET created_at = ? WHERE event_id = ?').run(
        oldTimestamp,
        evPending.eventId
      );

      // 3. DLQ:
      // Replayed DLQ record older than cutoff -> SHOULD BE PURGED
      await dlq.record({
        jobId: 'dlq-old-replayed',
        type: 'SEMANTIC_INDEX_UPDATE',
        workspaceId: 'ws-1',
        failureReason: 'err',
        errorCode: 'ERR',
        retryCount: 3,
        payload: {},
      });
      await dlq.markReplayed('dlq-old-replayed', 'admin');
      db.prepare('UPDATE pm_job_dead_letter SET replayed_at = ? WHERE job_id = ?').run(
        oldTimestamp,
        'dlq-old-replayed'
      );

      // Pending DLQ record -> MUST BE PROTECTED (NOT PURGED)
      await dlq.record({
        jobId: 'dlq-pending',
        type: 'SEMANTIC_INDEX_UPDATE',
        workspaceId: 'ws-1',
        failureReason: 'unresolved failure',
        errorCode: 'ERR',
        retryCount: 3,
        payload: {},
      });
      db.prepare('UPDATE pm_job_dead_letter SET dead_lettered_at = ? WHERE job_id = ?').run(
        oldTimestamp,
        'dlq-pending'
      );

      // Execute retention purge (14 days for completed jobs, 7 days for outbox, 30 days for replayed DLQ)
      const retentionService = new JobRetentionService(db, {
        completedJobsRetentionDays: 14,
        dispatchedOutboxRetentionDays: 7,
        replayedDeadLetterRetentionDays: 14,
      });

      const purgeResult = await retentionService.purgeExpiredRecords();

      expect(purgeResult.purgedJobsCount).toBe(1);
      expect(purgeResult.purgedOutboxCount).toBe(1);
      expect(purgeResult.purgedDeadLetterCount).toBe(1);

      // Verify that active and pending items were safely preserved
      expect(await repo.getById('job-old-completed')).toBeNull(); // Purged
      expect(await repo.getById('job-recent-completed')).not.toBeNull(); // Retained
      expect(await repo.getById('job-old-queued')).not.toBeNull(); // Retained (active!)

      const outboxPending = await outbox.fetchPendingEvents();
      expect(outboxPending.some((e) => e.eventId === evPending.eventId)).toBe(true); // Retained!

      expect(await dlq.get('dlq-pending')).not.toBeNull(); // Retained!
    });
  });
});
