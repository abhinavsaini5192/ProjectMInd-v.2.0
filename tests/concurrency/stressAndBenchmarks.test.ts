import { describe, it, expect } from 'vitest';
import { ResourceLockManager } from '../../src/concurrency/locking/ResourceLockManager.js';
import { RequestCoalescer } from '../../src/concurrency/coalescing/RequestCoalescer.js';
import { WorkloadLimiter } from '../../src/concurrency/limits/WorkloadLimiter.js';
import { OptimisticLockManager } from '../../src/storage/consistency/OptimisticLockManager.js';

describe('Concurrency - Stress & Performance Benchmarks (Section 50)', () => {
  it('handles 10 simultaneous updates and 50 simultaneous reads with zero corruption', async () => {
    const optimistic = new OptimisticLockManager();
    const readResults: number[] = [];
    let updateSuccesses = 0;
    let updateConflicts = 0;

    optimistic.registerVersion('Resource', 'res-shared', 100);

    // 50 simultaneous reads
    const reads = Array.from({ length: 50 }, async () => {
      const v = optimistic.getVersion('Resource', 'res-shared') ?? 0;
      readResults.push(v);
      return v;
    });

    // 10 simultaneous updates all expecting version 100
    const updates = Array.from({ length: 10 }, async (_v, i) => {
      try {
        await optimistic.incrementVersion('Resource', 'res-shared', 100);
        updateSuccesses++;
      } catch {
        updateConflicts++;
      }
    });

    await Promise.all([...reads, ...updates]);

    // All 50 reads returned valid versions (>= 100)
    expect(readResults.length).toBe(50);
    for (const v of readResults) {
      expect(v).toBeGreaterThanOrEqual(100);
    }

    // Exactly 1 update succeeded from version 100, 9 received conflicts
    expect(updateSuccesses).toBe(1);
    expect(updateConflicts).toBe(9);
    expect(optimistic.getVersion('Resource', 'res-shared')).toBe(101);
  });

  it('measures ResourceLockManager acquire/release throughput (10,000 operations)', async () => {
    const lockManager = new ResourceLockManager();
    const iterations = 10000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const key = `ws:bench:repo:1:lock:${i % 100}`;
      const res = await lockManager.acquire(key, `owner-${i}`);
      if (res.success) {
        await lockManager.release(res.lock!.lockId, `owner-${i}`);
      }
    }
    const elapsedMs = performance.now() - start;
    const opsPerSec = Math.floor((iterations / elapsedMs) * 1000);

    console.log(`[PERF] ResourceLockManager: ${elapsedMs.toFixed(2)}ms for ${iterations} ops (${opsPerSec} ops/sec)`);
    expect(opsPerSec).toBeGreaterThan(10000);
  });

  it('measures RequestCoalescer throughput under concurrent stampede (10,000 calls)', async () => {
    const coalescer = new RequestCoalescer();
    const calls = 10000;
    let computeExecutions = 0;

    const compute = async () => {
      computeExecutions++;
      return { status: 'OK' };
    };

    const start = performance.now();
    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < calls; i++) {
      const key = `key-stampede-${i % 10}`;
      promises.push(coalescer.coalesce(key, compute));
    }
    await Promise.all(promises);
    const elapsedMs = performance.now() - start;
    const opsPerSec = Math.floor((calls / elapsedMs) * 1000);

    console.log(`[PERF] RequestCoalescer: ${elapsedMs.toFixed(2)}ms for ${calls} calls (${opsPerSec} calls/sec)`);
    expect(computeExecutions).toBeLessThanOrEqual(50);
    expect(opsPerSec).toBeGreaterThan(50000);
  });

  it('measures WorkloadLimiter acquire/release throughput (5,000 operations)', async () => {
    const limiter = new WorkloadLimiter({
      maxGlobalConcurrency: 100,
      maxWorkspaceConcurrency: 20,
    });
    const ops = 5000;

    const start = performance.now();
    for (let i = 0; i < ops; i++) {
      const rel = await limiter.acquire({
        workloadId: `w-${i}`,
        workspaceId: `ws-${i % 10}`,
        operation: 'eval',
      });
      rel();
    }
    const elapsedMs = performance.now() - start;
    const opsPerSec = Math.floor((ops / elapsedMs) * 1000);

    console.log(`[PERF] WorkloadLimiter: ${elapsedMs.toFixed(2)}ms for ${ops} ops (${opsPerSec} ops/sec)`);
    expect(opsPerSec).toBeGreaterThan(50000);
  });
});
