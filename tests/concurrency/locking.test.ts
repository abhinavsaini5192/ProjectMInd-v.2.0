import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceLockManager } from '../../src/concurrency/locking/ResourceLockManager.js';

describe('Concurrency - ResourceLockManager', () => {
  let lockManager: ResourceLockManager;

  beforeEach(() => {
    lockManager = new ResourceLockManager({ defaultTtlMs: 200, maxTtlMs: 2000 });
  });

  it('acquires and releases a resource lock successfully', async () => {
    const key = ResourceLockManager.buildKey('ws-1', 'repo-1', 'feature', 'edit');
    const result = await lockManager.acquire(key, 'worker-1');

    expect(result.success).toBe(true);
    expect(result.lock).toBeDefined();
    expect(result.lock?.ownerId).toBe('worker-1');
    expect(result.lock?.resourceKey).toBe(key);
    expect(await lockManager.isLocked(key)).toBe(true);

    const released = await lockManager.release(result.lock!.lockId, 'worker-1');
    expect(released).toBe(true);
    expect(await lockManager.isLocked(key)).toBe(false);
  });

  it('detects lock contention and rejects concurrent acquisition', async () => {
    const key = ResourceLockManager.buildKey('ws-1', 'repo-1', 'migration');
    const first = await lockManager.acquire(key, 'instance-a');
    expect(first.success).toBe(true);

    const second = await lockManager.acquire(key, 'instance-b');
    expect(second.success).toBe(false);
    expect(second.error).toBe('LOCK_CONTENDED');
    expect(second.currentOwner).toBe('instance-a');
    expect(second.remainingTtlMs).toBeGreaterThan(0);
  });

  it('permits re-entrant renewal by the same owner', async () => {
    const key = ResourceLockManager.buildKey('ws-1', 'repo-1', 'feature', 'edit');
    const first = await lockManager.acquire(key, 'worker-1', { ttlMs: 100 });
    expect(first.success).toBe(true);

    const reentrant = await lockManager.acquire(key, 'worker-1', { ttlMs: 500 });
    expect(reentrant.success).toBe(true);
    expect(reentrant.lock?.lockId).toBe(first.lock?.lockId);
    expect(reentrant.lock?.ttlMs).toBe(500);
  });

  it('prohibits renewal or release by a different owner', async () => {
    const key = ResourceLockManager.buildKey('ws-1', 'repo-1', 'feature', 'edit');
    const first = await lockManager.acquire(key, 'worker-1');
    const lockId = first.lock!.lockId;

    const renewByWrongOwner = await lockManager.renew(lockId, 'worker-imposter', 500);
    expect(renewByWrongOwner).toBe(false);

    const releaseByWrongOwner = await lockManager.release(lockId, 'worker-imposter');
    expect(releaseByWrongOwner).toBe(false);
    expect(await lockManager.isLocked(key)).toBe(true);

    // Legitimate owner can still release
    const legitimateRelease = await lockManager.release(lockId, 'worker-1');
    expect(legitimateRelease).toBe(true);
  });

  it('automatically reclaims expired locks after TTL elapses', async () => {
    const key = ResourceLockManager.buildKey('ws-1', 'repo-1', 'feature', 'temp');
    await lockManager.acquire(key, 'worker-crash', { ttlMs: 50 });

    expect(await lockManager.isLocked(key)).toBe(true);

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 70));

    expect(await lockManager.isLocked(key)).toBe(false);

    // Another worker can now acquire the expired lock
    const second = await lockManager.acquire(key, 'worker-recovery');
    expect(second.success).toBe(true);
    expect(second.lock?.ownerId).toBe('worker-recovery');
  });

  it('supports waiting for lock release with bounded timeout', async () => {
    const key = ResourceLockManager.buildKey('ws-1', 'repo-1', 'queue');
    await lockManager.acquire(key, 'worker-slow', { ttlMs: 50 });

    // worker-fast waits up to 150ms for worker-slow's lock (which expires in 50ms)
    const result = await lockManager.acquire(key, 'worker-fast', { waitTimeoutMs: 150 });
    expect(result.success).toBe(true);
    expect(result.lock?.ownerId).toBe('worker-fast');
  });

  it('times out when lock is held longer than waitTimeoutMs', async () => {
    const key = ResourceLockManager.buildKey('ws-1', 'repo-1', 'long-op');
    await lockManager.acquire(key, 'worker-holding', { ttlMs: 500 });

    const result = await lockManager.acquire(key, 'worker-waiting', { waitTimeoutMs: 50 });
    expect(result.success).toBe(false);
    expect(result.error).toBe('TIMEOUT');
  });
});
