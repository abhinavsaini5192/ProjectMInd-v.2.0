import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SqliteTransactionalOutbox } from '../../src/jobs/events/outbox/SqliteTransactionalOutbox.js';
import { OutboxDispatcher } from '../../src/jobs/events/outbox/OutboxDispatcher.js';
import { SqliteTransactionalInbox } from '../../src/jobs/events/inbox/SqliteTransactionalInbox.js';
import { InboxProcessor } from '../../src/jobs/events/inbox/InboxProcessor.js';
import { EventReplayManager } from '../../src/jobs/events/replay/EventReplayManager.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';

describe('Transactional Outbox, Inbox & Replay Engine', () => {
  let db: Database.Database;
  let outbox: SqliteTransactionalOutbox;
  let inbox: SqliteTransactionalInbox;
  let eventBus: NodeEventBus;

  beforeEach(() => {
    db = new Database(':memory:');
    outbox = new SqliteTransactionalOutbox(db);
    inbox = new SqliteTransactionalInbox(db);
    eventBus = new NodeEventBus();
  });

  afterEach(() => {
    db.close();
  });

  describe('SqliteTransactionalOutbox', () => {
    it('persists outbox events with monotonic per-aggregate sequence numbers', async () => {
      const event1 = await outbox.insertEvent({
        eventType: 'repository.file.updated',
        workspaceId: 'ws-test',
        aggregateType: 'repository',
        aggregateId: 'repo-100',
        payload: { path: '/src/main.ts', change: 'edit' },
      });

      const event2 = await outbox.insertEvent({
        eventType: 'repository.file.updated',
        workspaceId: 'ws-test',
        aggregateType: 'repository',
        aggregateId: 'repo-100',
        payload: { path: '/src/main.ts', change: 'save' },
      });

      // Different aggregate gets its own sequence starting at 1
      const eventDiffAgg = await outbox.insertEvent({
        eventType: 'repository.file.updated',
        workspaceId: 'ws-test',
        aggregateType: 'repository',
        aggregateId: 'repo-200',
        payload: { path: '/readme.md' },
      });

      expect(event1.aggregateSeq).toBe(1);
      expect(event2.aggregateSeq).toBe(2);
      expect(eventDiffAgg.aggregateSeq).toBe(1);

      expect(await outbox.getDepth()).toBe(3);
    });

    it('dispatches pending events and marks them dispatched via OutboxDispatcher', async () => {
      await outbox.insertEvent({
        eventType: 'workspace.project.created',
        workspaceId: 'ws-alpha',
        aggregateType: 'workspace',
        aggregateId: 'ws-alpha',
        payload: { name: 'Alpha Project' },
      });

      const received: any[] = [];
      eventBus.subscribe('workspace.project.created', (e: any) => { received.push(e); });

      const dispatcher = new OutboxDispatcher(outbox, eventBus, { batchSize: 10 });
      const dispatched = await dispatcher.dispatchBatch();

      expect(dispatched).toBe(1);
      expect(received.length).toBe(1);
      expect(received[0].payload.data).toEqual({ name: 'Alpha Project' });

      // Outbox depth drops to 0 pending
      expect(await outbox.getDepth()).toBe(0);
    });
  });

  describe('SqliteTransactionalInbox & InboxProcessor', () => {
    it('deduplicates duplicate event deliveries and enforces idempotent handling', async () => {
      const processor = new InboxProcessor(inbox, 'knowledge-indexer');

      let executionCount = 0;
      const testHandler = async (evt: any) => {
        executionCount++;
        return { indexedDocs: 1 };
      };

      const eventPayload = {
        eventId: 'evt-dup-test-999',
        eventType: 'document.indexed',
        aggregateType: 'document',
        aggregateId: 'doc-42',
        aggregateSeq: 1,
        data: { title: 'Architecture Guide' },
      };

      // First delivery: processes successfully
      const res1 = await processor.processEvent(eventPayload, testHandler);
      expect(res1.processed).toBe(true);
      expect(res1.duplicate).toBe(false);
      expect(executionCount).toBe(1);

      // Duplicate delivery with same eventId: skipped
      const res2 = await processor.processEvent(eventPayload, testHandler);
      expect(res2.processed).toBe(false);
      expect(res2.duplicate).toBe(true);
      expect(executionCount).toBe(1); // Handler was not executed again!

      expect(await inbox.getProcessedCount('knowledge-indexer')).toBe(1);
    });

    it('detects out-of-order aggregate sequence numbers', async () => {
      const processor = new InboxProcessor(inbox, 'audit-consumer');

      // Process sequence 1
      await processor.processEvent(
        {
          eventId: 'evt-seq-1',
          eventType: 'entity.modified',
          aggregateType: 'entity',
          aggregateId: 'ent-1',
          aggregateSeq: 1,
          data: {},
        },
        async () => {}
      );

      // Now receive sequence 5 (skipping 2, 3, 4)
      const resOutOfOrder = await processor.processEvent(
        {
          eventId: 'evt-seq-5',
          eventType: 'entity.modified',
          aggregateType: 'entity',
          aggregateId: 'ent-1',
          aggregateSeq: 5,
          data: {},
        },
        async () => {}
      );

      expect(resOutOfOrder.processed).toBe(true);
      expect(resOutOfOrder.outOfOrder).toBe(true); // Flagged as out-of-order!
    });
  });

  describe('EventReplayManager', () => {
    it('replays historical events within bounded batches and maintains audit log', async () => {
      // Create and dispatch 3 events
      const ev1 = await outbox.insertEvent({
        eventType: 'config.updated',
        workspaceId: 'ws-replay',
        aggregateType: 'config',
        aggregateId: 'cfg-1',
        payload: { v: 1 },
      });
      await outbox.markDispatched(ev1.eventId);

      const ev2 = await outbox.insertEvent({
        eventType: 'config.updated',
        workspaceId: 'ws-replay',
        aggregateType: 'config',
        aggregateId: 'cfg-1',
        payload: { v: 2 },
      });
      await outbox.markDispatched(ev2.eventId);

      // Outbox has 0 pending
      expect(await outbox.getDepth()).toBe(0);

      const replayManager = new EventReplayManager(db);

      // Trigger authorized replay
      const audit = await replayManager.replayEvents(
        { workspaceId: 'ws-replay', maxBatchSize: 10 },
        'lead-architect',
        'Re-indexing workspace configuration after disaster recovery'
      );

      expect(audit.eventsMatched).toBe(2);
      expect(audit.eventsReplayed).toBe(2);
      expect(audit.initiatedBy).toBe('lead-architect');

      // Outbox now has 2 events marked PENDING ready for redelivery
      expect(await outbox.getDepth()).toBe(2);

      // Audit history records replay
      const history = await replayManager.getAuditHistory();
      expect(history.length).toBe(1);
      expect(history[0].replayId).toBe(audit.replayId);
      expect(history[0].reason).toContain('disaster recovery');
    });

    it('rejects unauthenticated or unauthorized replay attempts without reason', async () => {
      const replayManager = new EventReplayManager(db);

      await expect(
        replayManager.replayEvents({}, '', 'valid reason')
      ).rejects.toThrowError(/Authorized operator identity is required/);

      await expect(
        replayManager.replayEvents({}, 'operator-1', '')
      ).rejects.toThrowError(/Operational reason is required/);
    });
  });
});
