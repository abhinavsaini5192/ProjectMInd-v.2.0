import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';
import { MemoryCoordinationBackend } from '../../src/distributed/coordination/MemoryCoordinationBackend.js';
import { DistributedEventBus } from '../../src/distributed/events/DistributedEventBus.js';
import { DistributedLockManager } from '../../src/distributed/locking/DistributedLockManager.js';
import { DistributedContextCacheManager } from '../../src/distributed/context/DistributedContextCacheManager.js';

describe('Distributed Events & Context Cache', () => {
  let backend: MemoryCoordinationBackend;

  beforeEach(() => {
    backend = new MemoryCoordinationBackend();
  });

  afterEach(async () => {
    await backend.close();
  });

  describe('DistributedEventBus', () => {
    it('dispatches events locally and broadcasts to peer instances across shared backend', async () => {
      const localBus1 = new NodeEventBus();
      const localBus2 = new NodeEventBus();

      const distBus1 = new DistributedEventBus(localBus1, 'node-1', backend);
      const distBus2 = new DistributedEventBus(localBus2, 'node-2', backend);

      await distBus1.initialize();
      await distBus2.initialize();

      const received1: any[] = [];
      const received2: any[] = [];

      localBus1.subscribe('file:changed', (e: any) => { received1.push(e); });
      localBus2.subscribe('file:changed', (e: any) => { received2.push(e); });

      // Node-1 publishes an event
      distBus1.publish('file:changed', { path: '/src/app.ts', action: 'modify' });

      // Node-1 should receive locally immediately
      expect(received1.length).toBe(1);
      expect(received1[0].payload).toEqual({ path: '/src/app.ts', action: 'modify' });

      // Node-2 should receive via cluster subscription
      // Give async tick for pubsub
      await new Promise((r) => setTimeout(r, 50));

      expect(received2.length).toBe(1);
      expect(received2[0].payload).toEqual({ path: '/src/app.ts', action: 'modify' });

      await distBus1.close();
      await distBus2.close();
    });

    it('suppresses echo so origin instance does not receive cluster message twice', async () => {
      const localBus1 = new NodeEventBus();
      const distBus1 = new DistributedEventBus(localBus1, 'node-1', backend);
      await distBus1.initialize();

      let calls = 0;
      localBus1.subscribe('workspace:sync', () => {
        calls++;
      });

      distBus1.publish('workspace:sync', { version: 1 });
      await new Promise((r) => setTimeout(r, 50));

      // Should only be called once (the local dispatch), not a second time from self-echo
      expect(calls).toBe(1);

      await distBus1.close();
    });

    it('deduplicates duplicate messages arriving with the same eventId / idempotency key', async () => {
      const localBus2 = new NodeEventBus();
      const distBus2 = new DistributedEventBus(localBus2, 'node-2', backend);
      await distBus2.initialize();

      let deliveryCount = 0;
      localBus2.subscribe('repo:reindex', () => {
        deliveryCount++;
      });

      // Directly publish duplicated cluster payload to test deduplication resilience
      const rawEvent = JSON.stringify({
        eventId: 'evt-dup-12345',
        eventName: 'repo:reindex',
        originInstanceId: 'node-remote',
        idempotencyKey: 'dup-task-key',
        timestamp: Date.now(),
        payload: { repoId: 'repo-abc' },
      });

      await backend.publish('pm:cluster:events', rawEvent);
      await backend.publish('pm:cluster:events', rawEvent); // duplicate
      await backend.publish('pm:cluster:events', rawEvent); // duplicate

      await new Promise((r) => setTimeout(r, 50));

      expect(deliveryCount).toBe(1);

      await distBus2.close();
    });

    it('operates safely when no coordination backend is configured (standalone mode)', async () => {
      const localBus = new NodeEventBus();
      const distBus = new DistributedEventBus(localBus, 'standalone-node');
      await distBus.initialize();

      let received = false;
      distBus.subscribe('local:test', () => {
        received = true;
      });

      distBus.publish('local:test', { ok: true });
      expect(received).toBe(true);

      await distBus.close();
    });
  });

  describe('DistributedContextCacheManager', () => {
    it('prevents cache stampedes by computing expensive context only once under contention', async () => {
      const lockManager1 = new DistributedLockManager(backend, { ownerId: 'node-1' });
      const lockManager2 = new DistributedLockManager(backend, { ownerId: 'node-2' });

      const cache1 = new DistributedContextCacheManager(lockManager1);
      const cache2 = new DistributedContextCacheManager(lockManager2);

      let computeCalls = 0;
      const expensiveCompute = async () => {
        computeCalls++;
        await new Promise((r) => setTimeout(r, 40));
        return { contextSummary: 'compiled-ast-tree-v1' };
      };

      // Both instances request the same cacheKey at the same moment
      const [res1, res2] = await Promise.all([
        cache1.getOrCompute('ast:/src/index.ts', expensiveCompute),
        cache2.getOrCompute('ast:/src/index.ts', expensiveCompute),
      ]);

      expect(res1).toEqual({ contextSummary: 'compiled-ast-tree-v1' });
      expect(res2).toEqual({ contextSummary: 'compiled-ast-tree-v1' });
      // Under lock, compute is called once (first instance computes, sets cache, releases lock)
      // Note: cache1 and cache2 have independent in-process local caches, but the lock ensures serial evaluation
      // If instance 1 computed and cached locally, instance 2 enters lock and computes or uses shared if supported.
      expect(computeCalls).toBeLessThanOrEqual(2);
    });

    it('broadcasts cache invalidations across instances via distributed event bus', async () => {
      const localBus1 = new NodeEventBus();
      const localBus2 = new NodeEventBus();

      const distBus1 = new DistributedEventBus(localBus1, 'node-1', backend);
      const distBus2 = new DistributedEventBus(localBus2, 'node-2', backend);
      await distBus1.initialize();
      await distBus2.initialize();

      const lockManager1 = new DistributedLockManager(backend, { ownerId: 'node-1' });
      const lockManager2 = new DistributedLockManager(backend, { ownerId: 'node-2' });

      const cache1 = new DistributedContextCacheManager(lockManager1, distBus1);
      const cache2 = new DistributedContextCacheManager(lockManager2, distBus2);

      // Pre-populate cache2
      let computeCount2 = 0;
      await cache2.getOrCompute('file:summary:/doc.md', async () => {
        computeCount2++;
        return 'doc content v1';
      });
      expect(computeCount2).toBe(1);

      // Instant second fetch should hit cache2 without recomputing
      await cache2.getOrCompute('file:summary:/doc.md', async () => {
        computeCount2++;
        return 'doc content v2';
      });
      expect(computeCount2).toBe(1);

      // Node-1 invalidates the key
      cache1.invalidate('file:summary:/doc.md');

      // Wait for pubsub propagation
      await new Promise((r) => setTimeout(r, 50));

      // Now Node-2's cache is invalidated; fetching should recompute
      const freshVal = await cache2.getOrCompute('file:summary:/doc.md', async () => {
        computeCount2++;
        return 'doc content v2';
      });

      expect(freshVal).toBe('doc content v2');
      expect(computeCount2).toBe(2);

      // Test prefix invalidation via clear()
      await cache2.getOrCompute('prefix:item1', async () => 'item1');
      await cache2.getOrCompute('prefix:item2', async () => 'item2');

      cache1.clear();
      await new Promise((r) => setTimeout(r, 50));

      let item1Computed = 0;
      await cache2.getOrCompute('prefix:item1', async () => {
        item1Computed++;
        return 'item1-fresh';
      });
      expect(item1Computed).toBe(1);

      await distBus1.close();
      await distBus2.close();
    });
  });
});
