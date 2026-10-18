import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryCoordinationBackend } from '../../src/distributed/coordination/MemoryCoordinationBackend.js';
import { DistributedServiceDiscovery } from '../../src/distributed/discovery/DistributedServiceDiscovery.js';
import { DistributedRuntimeLifecycle } from '../../src/distributed/lifecycle/DistributedRuntimeLifecycle.js';
import type { DistributedConfig } from '../../src/distributed/models/DistributedConfig.js';

describe('Phase 10.3 — Service Discovery & Runtime Lifecycle', () => {
  let backend: MemoryCoordinationBackend;
  let config: DistributedConfig;
  let discovery1: DistributedServiceDiscovery;
  let discovery2: DistributedServiceDiscovery;

  beforeEach(() => {
    backend = new MemoryCoordinationBackend();
    config = {
      mode: 'distributed',
      backend: 'memory',
      role: 'HYBRID',
      heartbeatIntervalMs: 50,
      staleThresholdMs: 150, // 150ms for fast deterministic testing
      defaultLockTtlMs: 5000,
      acquireTimeoutMs: 1000,
      retryIntervalMs: 25,
      shutdownTimeoutMs: 1000,
      distributedEventsEnabled: true,
    };
    discovery1 = new DistributedServiceDiscovery(backend, config, 'node-worker-1');
    discovery2 = new DistributedServiceDiscovery(backend, config, 'node-worker-2');
  });

  afterEach(async () => {
    await discovery1.close();
    await discovery2.close();
    await backend.close();
  });

  it('registers instance with capabilities and updates heartbeat timestamps', async () => {
    const record = await discovery1.register(['parser', 'indexer'], { region: 'us-east-1' });
    expect(record.instanceId).toBe('node-worker-1');
    expect(record.state).toBe('READY');
    expect(record.capabilities).toContain('parser');

    const initialHb = record.lastHeartbeatAt;
    // Wait for at least one heartbeat tick
    await new Promise((r) => setTimeout(r, 60));
    await discovery1.heartbeat();

    const updated = await discovery1.getInstance('node-worker-1');
    expect(updated).not.toBeNull();
    expect(updated!.lastHeartbeatAt).toBeGreaterThanOrEqual(initialHb);
  });

  it('discovers all active instances across the cluster', async () => {
    await discovery1.register();
    await discovery2.register();

    const active = await discovery1.getActiveInstances();
    expect(active.length).toBe(2);
    const ids = active.map((a) => a.instanceId);
    expect(ids).toContain('node-worker-1');
    expect(ids).toContain('node-worker-2');
  });

  it('prunes stale dead instances when heartbeats lapse past threshold', async () => {
    await discovery1.register();
    await discovery2.register();

    // Stop discovery2 heartbeat loop abruptly without deregistering
    await (discovery2 as any).heartbeatTimer && clearInterval((discovery2 as any).heartbeatTimer);

    // Wait past staleThresholdMs (150ms)
    await new Promise((r) => setTimeout(r, 180));

    // discovery1 should now only see itself as active
    const active = await discovery1.getActiveInstances();
    expect(active.length).toBe(1);
    expect(active[0]?.instanceId).toBe('node-worker-1');
  });

  it('deregisters cleanly upon graceful shutdown', async () => {
    await discovery1.register();
    await discovery2.register();

    await discovery2.deregister();

    const active = await discovery1.getActiveInstances();
    expect(active.length).toBe(1);
    expect(active[0]?.instanceId).toBe('node-worker-1');
  });

  it('elects a stable cluster leader among competing nodes', async () => {
    await discovery1.register();
    await discovery2.register();

    const leader1 = await discovery1.getLeader();
    const leader2 = await discovery2.getLeader();

    expect(leader1).not.toBeNull();
    expect(leader1).toBe(leader2); // Both instances agree on the same leader ID
  });

  it('manages runtime lifecycle states and work admission gates', async () => {
    const lifecycle = new DistributedRuntimeLifecycle(config, backend, undefined, discovery1);
    expect(lifecycle.getState()).toBe('STARTING');
    expect(lifecycle.canAcceptWork()).toBe(false);

    await lifecycle.initialize();
    expect(lifecycle.getState()).toBe('READY');
    expect(lifecycle.canAcceptWork()).toBe(true);

    // Enter work and exit work
    const exitWork = lifecycle.enterWork();
    expect(lifecycle.getActiveWorkCount()).toBe(1);
    exitWork();
    expect(lifecycle.getActiveWorkCount()).toBe(0);

    // Graceful shutdown
    await lifecycle.shutdown();
    expect(lifecycle.getState()).toBe('STOPPED');
    expect(lifecycle.canAcceptWork()).toBe(false);

    // Attempting to enter work in STOPPED state throws
    expect(() => lifecycle.enterWork()).toThrow("Cannot accept work: runtime is in state 'STOPPED'");
  });
});
