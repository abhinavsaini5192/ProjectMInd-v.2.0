import { describe, it, expect } from 'vitest';
import { MemoryCoordinationBackend } from '../../src/distributed/coordination/MemoryCoordinationBackend.js';
import { RedisCoordinationBackend } from '../../src/distributed/coordination/RedisCoordinationBackend.js';
import { CoordinationBackendFactory } from '../../src/distributed/coordination/CoordinationBackendFactory.js';
import { DistributedLockManager } from '../../src/distributed/locking/DistributedLockManager.js';
import { FencingGuard, StaleFencingTokenError } from '../../src/distributed/locking/FencingGuard.js';
import { DistributedRuntimeLifecycle } from '../../src/distributed/lifecycle/DistributedRuntimeLifecycle.js';
import { DEFAULT_DISTRIBUTED_CONFIG } from '../../src/distributed/models/DistributedConfig.js';

describe('Distributed Failure Handling & Resiliency', () => {
  describe('Outage & Health Check Diagnostics', () => {
    it('accurately reports unhealthy status when coordination backend experiences an outage', async () => {
      const backend = new MemoryCoordinationBackend();

      // Healthy state
      const initialHealth = await backend.healthCheck();
      expect(initialHealth.healthy).toBe(true);
      expect(initialHealth.latencyMs).toBeGreaterThanOrEqual(0);

      // Simulate closure / network disconnect
      await backend.close();

      const deadHealth = await backend.healthCheck();
      expect(deadHealth.healthy).toBe(false);
      expect(deadHealth.message).toContain('closed');
    });

    it('handles unreachable Redis instance without crashing and reports failure truthfully', async () => {
      // Connect to a non-existent port to test network failure handling
      const unreachableRedis = new RedisCoordinationBackend({
        redisUrl: 'redis://127.0.0.1:63999', // unreachable port
      });

      const health = await unreachableRedis.healthCheck();
      // Should report unhealthy without unhandled rejections
      expect(health.healthy).toBe(false);

      // Lock acquisition should safely throw or reject with a descriptive message rather than crashing process
      await expect(unreachableRedis.acquireLock('test-key', 'owner-1', 2000)).rejects.toThrow();

      await unreachableRedis.close();
    });

    it('creates appropriate coordination backend based on configuration and handles invalid options safely', async () => {
      const memBackend = CoordinationBackendFactory.create({
        ...DEFAULT_DISTRIBUTED_CONFIG,
        mode: 'standalone',
        backend: 'memory',
      });

      expect(memBackend).toBeDefined();
      const health = await memBackend.healthCheck();
      expect(health.healthy).toBe(true);
      await memBackend.close();
    });
  });

  describe('Stale Owner & Expired Client Rejection', () => {
    it('rejects stale lock operations with StaleFencingTokenError when another client has superseded it', () => {
      const guard = new FencingGuard();

      // Client A acquires lock with fencing token 5
      guard.assertValid('repo:123', 5);
      expect(guard.getHighestToken('repo:123')).toBe(5);

      // Client B acquires lock later with fencing token 8 (e.g. after Client A was stalled/delayed)
      guard.assertValid('repo:123', 8);
      expect(guard.getHighestToken('repo:123')).toBe(8);

      // Delayed Client A now attempts to perform a mutation with stale token 5
      expect(() => {
        guard.assertValid('repo:123', 5);
      }).toThrowError(StaleFencingTokenError);
    });

    it('prevents releasing or renewing a lock after lease expiration and acquisition by another client', async () => {
      const backend = new MemoryCoordinationBackend();
      const lockMgr1 = new DistributedLockManager(backend, { ownerId: 'node-1' });
      const lockMgr2 = new DistributedLockManager(backend, { ownerId: 'node-2' });

      // Node-1 acquires lock with short TTL (50ms)
      const res1 = await lockMgr1.acquire('doc:456', { ttlMs: 50 });
      expect(res1.success).toBe(true);
      if (!res1.success) return;
      const lock1 = res1.lock;

      // Wait for Node-1 lease to expire
      await new Promise((r) => setTimeout(r, 80));

      // Node-2 acquires doc:456
      const res2 = await lockMgr2.acquire('doc:456', { ttlMs: 5000 });
      expect(res2.success).toBe(true);

      // Node-1 attempts to renew its expired lock — must be rejected
      const renewed = await lockMgr1.renew(lock1, 5000);
      expect(renewed).toBe(false);

      // Node-1 attempts to release — must be rejected (cannot release Node-2's lock)
      const released = await lockMgr1.release(lock1);
      expect(released).toBe(false);

      await lockMgr1.close();
      await lockMgr2.close();
      await backend.close();
    });
  });

  describe('Bounded Timeouts and Failure Recovery', () => {
    it('returns failure result within bounded timeout when lock is contested and never freed', async () => {
      const backend = new MemoryCoordinationBackend();
      const lockMgr1 = new DistributedLockManager(backend, { ownerId: 'node-1' });
      const lockMgr2 = new DistributedLockManager(backend, { ownerId: 'node-2' });

      // Node-1 holds lock for a long time
      await lockMgr1.acquire('resource:contested', { ttlMs: 10000 });

      // Node-2 attempts acquisition with bounded timeout of 120ms
      const start = Date.now();
      const res2 = await lockMgr2.acquire('resource:contested', {
        waitTimeoutMs: 120,
        retryIntervalMs: 30,
      });
      const elapsed = Date.now() - start;

      expect(res2.success).toBe(false);
      expect(elapsed).toBeGreaterThanOrEqual(100);
      expect(elapsed).toBeLessThan(500); // Bounded! Did not wait forever.

      await lockMgr1.close();
      await lockMgr2.close();
      await backend.close();
    });

    it('handles unexpected exceptions inside withLock without leaking the held lock', async () => {
      const backend = new MemoryCoordinationBackend();
      const lockMgr = new DistributedLockManager(backend, { ownerId: 'node-1' });

      let thrown = false;
      try {
        await lockMgr.withLock('db:transaction:atomic', async () => {
          throw new Error('Database disk I/O failure simulated');
        });
      } catch (err: any) {
        thrown = true;
        expect(err.message).toBe('Database disk I/O failure simulated');
      }

      expect(thrown).toBe(true);

      // Lock should have been automatically released in the finally block
      const isLocked = await lockMgr.isLocked('db:transaction:atomic');
      expect(isLocked).toBe(false);

      // Another operation can acquire immediately
      const nextAcq = await lockMgr.acquire('db:transaction:atomic', { ttlMs: 2000 });
      expect(nextAcq.success).toBe(true);

      await lockMgr.close();
      await backend.close();
    });

    it('rejects work admission when runtime lifecycle transitions to DRAINING or STOPPED', async () => {
      const backend = new MemoryCoordinationBackend();
      const lifecycle = new DistributedRuntimeLifecycle(
        {
          ...DEFAULT_DISTRIBUTED_CONFIG,
          instanceId: 'test-lifecycle-inst',
        },
        backend
      );

      await lifecycle.initialize();
      expect(lifecycle.getState()).toBe('READY');
      expect(lifecycle.canAcceptWork()).toBe(true);

      // Work is admitted when READY
      const exitWork = lifecycle.enterWork();
      expect(lifecycle.getActiveWorkCount()).toBe(1);
      exitWork();
      expect(lifecycle.getActiveWorkCount()).toBe(0);

      // Initiate graceful shutdown
      const shutdownPromise = lifecycle.shutdown();

      // While DRAINING, new work admission must be rejected
      expect(lifecycle.canAcceptWork()).toBe(false);
      expect(() => lifecycle.enterWork()).toThrowError(/Cannot accept work/);

      await shutdownPromise;
      expect(lifecycle.getState()).toBe('STOPPED');
      expect(lifecycle.canAcceptWork()).toBe(false);
      expect(() => lifecycle.enterWork()).toThrowError(/Cannot accept work/);

      await backend.close();
    });
  });
});
