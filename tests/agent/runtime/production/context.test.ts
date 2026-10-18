import { describe, it, expect, beforeEach } from 'vitest';
import { createTestProductionRuntime } from './ProductionRuntimeTestHelper.js';

describe('ProductionAgentRuntime - Context Coordination', () => {
  let ctx: ReturnType<typeof createTestProductionRuntime>;

  beforeEach(async () => {
    ctx = createTestProductionRuntime();
    await ctx.runtime.initialize();
    await ctx.runtime.start();
  });

  it('retrieves current context and respects auto-refresh settings', async () => {
    const result = await ctx.runtime.getContext('ctx_sess_1', { autoRefreshIfStale: true });

    expect(result.contextSession.contextSessionId).toBe('ctx_sess_1');
    expect(result.contextPackage).toBeDefined();
    expect(result.wasRefreshed).toBe(true);

    const metrics = ctx.runtime.getMetrics();
    expect(metrics.contextRefreshes).toBe(1);
    expect(metrics.latencies.contextRetrieval.count).toBe(1);
  });

  it('explicitly refreshes context and increments contextRefreshes metric', async () => {
    const refreshResult = await ctx.runtime.refreshContext('ctx_sess_1');

    expect(refreshResult.refreshedVersion).toBe(2);
    expect(refreshResult.package).toBeDefined();

    const metrics = ctx.runtime.getMetrics();
    expect(metrics.contextRefreshes).toBe(1);
  });

  it('honors IMMEDIATE refresh policy by triggering refresh on markContextStale', async () => {
    const immediateCtx = createTestProductionRuntime({
      config: { contextRefreshPolicy: 'IMMEDIATE' },
    });
    await immediateCtx.runtime.initialize();
    await immediateCtx.runtime.start();

    // Call getContext
    await immediateCtx.runtime.getContext('ctx_sess_1');
    expect(immediateCtx.runtime.getMetrics().contextRefreshes).toBe(1);
  });
});
