import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryCoordinationBackend } from '../../src/distributed/coordination/MemoryCoordinationBackend.js';
import { DistributedLockManager } from '../../src/distributed/locking/DistributedLockManager.js';
import { FencingGuard, StaleFencingTokenError } from '../../src/distributed/locking/FencingGuard.js';

describe('Phase 10.3 — Distributed Locking & Fencing Engine', () => {
  let backend: MemoryCoordinationBackend;
  let guard: FencingGuard;
  let lockManager1: DistributedLockManager;
  let lockManager2: DistributedLockManager;

  beforeEach(() => {
    backend = new MemoryCoordinationBackend();
    guard = new FencingGuard();
    lockManager1 = new DistributedLockManager(backend, { ownerId: 'instance-alpha' }, guard);
    lockManager2 = new DistributedLockManager(backend, { ownerId: 'instance-beta' }, guard);
  });

  afterEach(async () => {
    await lockManager1.close();
    await lockManager2.close();
    await backend.close();
  });

  it('acquires exclusive lock on an unlocked resource and generates monotonically increasing fencing token', async () => {
    const result = await lockManager1.acquire('repo:projectmind:build', { ttlMs: 5000 });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.lock.lockKey).toBe('repo:projectmind:build');
    expect(result.lock.ownerId).toBe('instance-alpha');
    expect(result.lock.fencingToken).toBeGreaterThanOrEqual(1);
    expect(result.lock.expiresAt).toBeGreaterThan(Date.now());
    expect(result.lock.renewCount).toBe(0);
  });

  it('prevents a second instance from acquiring the same active lock (mutual exclusion)', async () => {
    const lock1 = await lockManager1.acquire('resource:shared-db', { ttlMs: 10000 });
    expect(lock1.success).toBe(true);

    const lock2 = await lockManager2.acquire('resource:shared-db', {
      ttlMs: 5000,
      waitTimeoutMs: 150, // Short timeout
      retryIntervalMs: 25,
    });

    expect(lock2.success).toBe(false);
    if (lock2.success) return;
    expect(lock2.error).toContain("timed out after");
    expect(lock2.currentLock?.ownerId).toBe('instance-alpha');
  });

  it('allows re-entrant renewal by the same owner instance', async () => {
    const lock1 = await lockManager1.acquire('resource:task-exec', { ttlMs: 2000 });
    expect(lock1.success).toBe(true);

    const lockReentry = await lockManager1.acquire('resource:task-exec', { ttlMs: 5000 });
    expect(lockReentry.success).toBe(true);
    if (!lockReentry.success) return;

    expect(lockReentry.lock.ownerId).toBe('instance-alpha');
    expect(lockReentry.lock.renewCount).toBe(1);
    expect(lockReentry.lock.ttlMs).toBe(5000);
  });

  it('prevents instance B from releasing a lock owned by instance A', async () => {
    const lock1 = await lockManager1.acquire('resource:isolated-write', { ttlMs: 10000 });
    expect(lock1.success).toBe(true);
    if (!lock1.success) return;

    // Instance 2 attempts to release instance 1's lock
    const releasedByB = await lockManager2.release(lock1.lock);
    expect(releasedByB).toBe(false);

    // Lock must still be held
    const isStillLocked = await lockManager1.isLocked('resource:isolated-write');
    expect(isStillLocked).toBe(true);

    // Instance 1 releases its own lock successfully
    const releasedByA = await lockManager1.release(lock1.lock);
    expect(releasedByA).toBe(true);

    expect(await lockManager1.isLocked('resource:isolated-write')).toBe(false);
  });

  it('allows lock acquisition after lease expiration without deadlock', async () => {
    // Acquire with short 50ms TTL
    const lock1 = await lockManager1.acquire('resource:short-lived', { ttlMs: 50 });
    expect(lock1.success).toBe(true);

    // Wait for lease to expire
    await new Promise((r) => setTimeout(r, 60));

    // Instance 2 can now acquire the expired lock with higher fencing token
    const lock2 = await lockManager2.acquire('resource:short-lived', { ttlMs: 5000 });
    expect(lock2.success).toBe(true);
    if (!lock2.success || !lock1.success) return;

    expect(lock2.lock.ownerId).toBe('instance-beta');
    expect(lock2.lock.fencingToken).toBeGreaterThan(lock1.lock.fencingToken);
  });

  it('FencingGuard rejects operations from stale clients holding superseded tokens', () => {
    guard.recordToken('doc:spec', 10);
    expect(guard.getHighestToken('doc:spec')).toBe(10);

    // Client with token 10 is valid
    expect(() => guard.assertValid('doc:spec', 10)).not.toThrow();

    // Client with newer token 12 is valid and updates highest token
    expect(() => guard.assertValid('doc:spec', 12)).not.toThrow();
    expect(guard.getHighestToken('doc:spec')).toBe(12);

    // Client with old token 10 is now STALE and rejected
    expect(() => guard.assertValid('doc:spec', 10)).toThrow(StaleFencingTokenError);
  });

  it('withLock automatically releases lock on successful execution and records metrics', async () => {
    let operationExecuted = false;

    const result = await lockManager1.withLock(
      'op:critical-section',
      async (lock) => {
        operationExecuted = true;
        expect(lock.ownerId).toBe('instance-alpha');
        return 'success-payload';
      },
      { ttlMs: 5000 }
    );

    expect(result).toBe('success-payload');
    expect(operationExecuted).toBe(true);

    // Verify lock was released immediately after execution
    expect(await lockManager1.isLocked('op:critical-section')).toBe(false);

    // Metrics verification
    const metrics = lockManager1.getMetrics();
    expect(metrics.totalAcquisitionAttempts).toBe(1);
    expect(metrics.successfulAcquisitions).toBe(1);
    expect(metrics.totalReleases).toBe(1);
    expect(metrics.activeLocksCount).toBe(0);
  });

  it('withLock safely releases lock even when operation throws an exception', async () => {
    await expect(
      lockManager1.withLock('op:failing-task', async () => {
        throw new Error('Simulated task crash inside lock');
      })
    ).rejects.toThrow('Simulated task crash inside lock');

    // Lock must not remain orphaned
    expect(await lockManager1.isLocked('op:failing-task')).toBe(false);
  });
});
