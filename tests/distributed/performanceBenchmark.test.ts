import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryCoordinationBackend } from '../../src/distributed/coordination/MemoryCoordinationBackend.js';
import { DistributedLockManager } from '../../src/distributed/locking/DistributedLockManager.js';
import { DistributedServiceDiscovery } from '../../src/distributed/discovery/DistributedServiceDiscovery.js';
import { DistributedEventBus } from '../../src/distributed/events/DistributedEventBus.js';
import { NodeEventBus } from '../../src/workspace/events/NodeEventBus.js';

interface LatencyStats {
  count: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
}

function calculateStats(samples: number[]): LatencyStats {
  if (samples.length === 0) {
    return { count: 0, totalMs: 0, avgMs: 0, minMs: 0, maxMs: 0, p95Ms: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const total = sorted.reduce((acc, v) => acc + v, 0);
  const p95Idx = Math.floor(sorted.length * 0.95);

  return {
    count: sorted.length,
    totalMs: Number(total.toFixed(2)),
    avgMs: Number((total / sorted.length).toFixed(3)),
    minMs: Number(sorted[0].toFixed(3)),
    maxMs: Number(sorted[sorted.length - 1].toFixed(3)),
    p95Ms: Number(sorted[p95Idx].toFixed(3)),
  };
}

describe('Coordination Performance & Contention Benchmarks', () => {
  let backend: MemoryCoordinationBackend;

  beforeEach(() => {
    backend = new MemoryCoordinationBackend();
  });

  afterEach(async () => {
    await backend.close();
  });

  it('measures uncontended lock acquisition and release latency over 100 cycles', async () => {
    const lockMgr = new DistributedLockManager(backend, { ownerId: 'bench-node-1' });
    const samples: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      const res = await lockMgr.acquire(`uncontended:res:${i}`, { ttlMs: 5000 });
      expect(res.success).toBe(true);
      if (res.success) {
        await lockMgr.release(res.lock);
      }
      const duration = performance.now() - start;
      samples.push(duration);
    }

    const stats = calculateStats(samples);
    expect(stats.count).toBe(100);
    expect(stats.avgMs).toBeLessThan(10); // In-memory backend should average sub-millisecond to low millisecond
    console.log('[BENCHMARK] Uncontended Lock (100 cycles):', JSON.stringify(stats));

    await lockMgr.close();
  });

  it('measures contended lock acquisition overhead across 4 concurrent instances over 40 acquisitions', async () => {
    const instances = [
      new DistributedLockManager(backend, { ownerId: 'node-contend-1' }),
      new DistributedLockManager(backend, { ownerId: 'node-contend-2' }),
      new DistributedLockManager(backend, { ownerId: 'node-contend-3' }),
      new DistributedLockManager(backend, { ownerId: 'node-contend-4' }),
    ];

    const samples: number[] = [];
    const sharedResource = 'shared:contentious:doc';
    let completed = 0;

    // Run 10 rounds where all 4 instances compete simultaneously (40 attempts total)
    for (let round = 0; round < 10; round++) {
      const promises = instances.map(async (mgr) => {
        const start = performance.now();
        const res = await mgr.acquire(sharedResource, {
          ttlMs: 2000,
          waitTimeoutMs: 3000,
          retryIntervalMs: 15,
        });

        if (res.success) {
          // Hold briefly to introduce contention
          await new Promise((r) => setTimeout(r, 5));
          await mgr.release(res.lock);
          completed++;
          samples.push(performance.now() - start);
        }
      });

      await Promise.all(promises);
    }

    const stats = calculateStats(samples);
    expect(completed).toBe(40);
    console.log('[BENCHMARK] Contended Lock (4 instances, 40 acquisitions):', JSON.stringify(stats));

    for (const mgr of instances) {
      await mgr.close();
    }
  });

  it('measures service discovery registration and heartbeat renewal latency over 100 cycles', async () => {
    const discovery = new DistributedServiceDiscovery(backend, {
      instanceId: 'bench-discovery-node',
      role: 'HYBRID',
      heartbeatIntervalMs: 5000,
      staleThresholdMs: 15000,
    });

    const regStart = performance.now();
    await discovery.register();
    const regDuration = performance.now() - regStart;

    const samples: number[] = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      const ok = await discovery.heartbeat();
      expect(ok).toBe(true);
      samples.push(performance.now() - start);
    }

    const stats = calculateStats(samples);
    expect(stats.count).toBe(100);
    expect(stats.avgMs).toBeLessThan(5);
    console.log('[BENCHMARK] Registration Latency:', regDuration.toFixed(3), 'ms');
    console.log('[BENCHMARK] Heartbeat Renewal (100 cycles):', JSON.stringify(stats));

    await discovery.deregister();
    await discovery.close();
  });

  it('measures cluster event dispatch and delivery latency over 100 events', async () => {
    const bus1 = new DistributedEventBus(new NodeEventBus(), 'bus-sender', backend);
    const bus2 = new DistributedEventBus(new NodeEventBus(), 'bus-receiver', backend);
    await bus1.initialize();
    await bus2.initialize();

    const samples: number[] = [];
    let receivedCount = 0;

    bus2.subscribe('bench:event', () => {
      receivedCount++;
    });

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      bus1.publish('bench:event', { seq: i, timestamp: Date.now() });
      samples.push(performance.now() - start);
    }

    // Wait a tick for pubsub delivery
    await new Promise((r) => setTimeout(r, 60));

    const stats = calculateStats(samples);
    expect(stats.count).toBe(100);
    expect(receivedCount).toBe(100);
    console.log('[BENCHMARK] Cluster Event Dispatch (100 events):', JSON.stringify(stats));

    await bus1.close();
    await bus2.close();
  });
});
