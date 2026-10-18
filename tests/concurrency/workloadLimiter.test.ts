import { describe, it, expect, beforeEach } from 'vitest';
import { WorkloadLimiter } from '../../src/concurrency/limits/WorkloadLimiter.js';

describe('Concurrency - WorkloadLimiter & Tenant Fairness', () => {
  let limiter: WorkloadLimiter;

  beforeEach(() => {
    limiter = new WorkloadLimiter({
      maxGlobalConcurrency: 4,
      maxWorkspaceConcurrency: 2,
      maxQueueDepth: 5,
      queueTimeoutMs: 200,
    });
  });

  it('allows concurrent requests up to global and workspace limits', async () => {
    const rel1 = await limiter.acquire({ workloadId: 'w1', workspaceId: 'ws-a', operation: 'op1' });
    const rel2 = await limiter.acquire({ workloadId: 'w2', workspaceId: 'ws-a', operation: 'op2' });

    expect(limiter.getGlobalInUse()).toBe(2);
    expect(limiter.getWorkspaceInUse('ws-a')).toBe(2);

    rel1();
    expect(limiter.getGlobalInUse()).toBe(1);
    expect(limiter.getWorkspaceInUse('ws-a')).toBe(1);

    rel2();
    expect(limiter.getGlobalInUse()).toBe(0);
    expect(limiter.getWorkspaceInUse('ws-a')).toBe(0);
  });

  it('enforces per-workspace limit and prevents Workspace A from starving Workspace B', async () => {
    // Workspace A consumes its limit of 2
    const relA1 = await limiter.acquire({ workloadId: 'wA1', workspaceId: 'ws-a', operation: 'op' });
    const relA2 = await limiter.acquire({ workloadId: 'wA2', workspaceId: 'ws-a', operation: 'op' });

    expect(limiter.getWorkspaceInUse('ws-a')).toBe(2);
    expect(limiter.canAccept({ workloadId: 'wA3', workspaceId: 'ws-a', operation: 'op' })).toBe(false);

    // Workspace B can still acquire permits up to its limit
    expect(limiter.canAccept({ workloadId: 'wB1', workspaceId: 'ws-b', operation: 'op' })).toBe(true);
    const relB1 = await limiter.acquire({ workloadId: 'wB1', workspaceId: 'ws-b', operation: 'op' });
    expect(limiter.getWorkspaceInUse('ws-b')).toBe(1);
    expect(limiter.getGlobalInUse()).toBe(3);

    relA1();
    relA2();
    relB1();
  });

  it('schedules queued requests by priority (CRITICAL before LOW)', async () => {
    // Saturate global capacity (4 permits)
    const rel1 = await limiter.acquire({ workloadId: '1', workspaceId: 'ws-1', operation: 'op' });
    const rel2 = await limiter.acquire({ workloadId: '2', workspaceId: 'ws-1', operation: 'op' });
    const rel3 = await limiter.acquire({ workloadId: '3', workspaceId: 'ws-2', operation: 'op' });
    const rel4 = await limiter.acquire({ workloadId: '4', workspaceId: 'ws-2', operation: 'op' });

    const executedOrder: string[] = [];

    // Queue LOW priority task for workspace 3
    const pLow = limiter.acquire({
      workloadId: 'low-1',
      workspaceId: 'ws-3',
      operation: 'op',
      priority: 'LOW',
    }).then((rel) => {
      executedOrder.push('LOW');
      rel();
    });

    // Queue CRITICAL priority task for workspace 3
    const pCrit = limiter.acquire({
      workloadId: 'crit-1',
      workspaceId: 'ws-3',
      operation: 'op',
      priority: 'CRITICAL',
    }).then((rel) => {
      executedOrder.push('CRITICAL');
      rel();
    });

    expect(limiter.getQueueDepth()).toBe(2);

    // Free one permit
    rel1();
    await new Promise((r) => setTimeout(r, 20));

    // Free second permit
    rel2();
    await Promise.all([pLow, pCrit]);

    // CRITICAL must have been scheduled before LOW
    expect(executedOrder[0]).toBe('CRITICAL');
    expect(executedOrder[1]).toBe('LOW');

    rel3();
    rel4();
  });

  it('rejects work with backpressure when queue depth limit is exceeded', async () => {
    // Fill global slots
    const releases: Array<() => void> = [];
    for (let i = 0; i < 4; i++) {
      releases.push(await limiter.acquire({ workloadId: `g-${i}`, workspaceId: `ws-${i}`, operation: 'op' }));
    }

    // Fill queue depth (5 items)
    for (let i = 0; i < 5; i++) {
      limiter.acquire({ workloadId: `q-${i}`, workspaceId: `ws-${i}`, operation: 'op' }).catch(() => {});
    }
    expect(limiter.getQueueDepth()).toBe(5);

    // 6th queued item must be rejected immediately with backpressure error
    await expect(
      limiter.acquire({ workloadId: 'overflow', workspaceId: 'ws-x', operation: 'op' })
    ).rejects.toThrow('Workload rejected due to backpressure');

    // Clean up
    for (const rel of releases) rel();
  });
});
