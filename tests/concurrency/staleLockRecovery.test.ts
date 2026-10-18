import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ResourceLockManager } from '../../src/concurrency/locking/ResourceLockManager.js';
import { StaleLockRecoveryManager } from '../../src/concurrency/recovery/StaleLockRecoveryManager.js';
import { ConcurrencyTelemetry } from '../../src/concurrency/observability/ConcurrencyTelemetry.js';

describe('Concurrency - Stale Lock Recovery & Observability', () => {
  let lockManager: ResourceLockManager;
  let telemetry: ConcurrencyTelemetry;
  let recovery: StaleLockRecoveryManager;

  beforeEach(() => {
    lockManager = new ResourceLockManager({ defaultTtlMs: 50, maxTtlMs: 500 });
    telemetry = new ConcurrencyTelemetry();
    recovery = new StaleLockRecoveryManager(lockManager, undefined, telemetry, { intervalMs: 30 });
  });

  afterEach(() => {
    recovery.stop();
  });

  it('detects and purges expired locks during manual sweep', async () => {
    const key1 = 'ws:1:repo:1:scope:task-1';
    const key2 = 'ws:1:repo:1:scope:task-2';

    await lockManager.acquire(key1, 'worker-dead', { ttlMs: 40 });
    await lockManager.acquire(key2, 'worker-alive', { ttlMs: 500 });

    expect(await lockManager.isLocked(key1)).toBe(true);
    expect(await lockManager.isLocked(key2)).toBe(true);

    // Wait for key1 to expire
    await new Promise((r) => setTimeout(r, 60));

    const sweepResult = await recovery.sweep();
    expect(sweepResult.purgedLocks).toContain(key1);
    expect(sweepResult.purgedLocks).not.toContain(key2);

    expect(await lockManager.isLocked(key1)).toBe(false);
    expect(await lockManager.isLocked(key2)).toBe(true);
  });

  it('records telemetry metrics and evaluates health diagnostic', () => {
    telemetry.recordLockAcquired('ws:1:repo:1:op:build', 15, 'worker-1');
    telemetry.recordLockAcquired('ws:1:repo:1:op:test', 20, 'worker-2');
    telemetry.recordLockContended('ws:1:repo:1:op:build', 'worker-3');
    telemetry.recordCoalescedRequest('context_refresh');
    telemetry.recordStaleResult('feat-1', 1, 2);

    const health = telemetry.getHealthDiagnostic();
    expect(health.status).toBe('HEALTHY');
    expect(health.activeLocks).toBe(2);
    expect(health.contentions).toBe(1);
    expect(health.coalescedRequests).toBe(1);
    expect(health.staleResults).toBe(1);
    expect(health.contentionRate).toBeCloseTo(1 / 3, 2);
  });
});
