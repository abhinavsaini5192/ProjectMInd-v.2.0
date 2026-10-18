import { describe, it, expect, vi } from 'vitest';
import { createTestProductionRuntime } from './ProductionRuntimeTestHelper.js';

describe('ProductionAgentRuntime - Knowledge Update Coordination & Invalidation', () => {
  it('propagates knowledge update invalidation by marking context stale', async () => {
    const ctx = createTestProductionRuntime();
    await ctx.runtime.initialize();
    await ctx.runtime.start();

    const spy = vi.spyOn(ctx.contextSessionManager, 'markContextStale');

    const coordinator = (ctx.runtime as any).coordinator.context;
    await coordinator.markContextStale('ctx_sess_1', 'KNOWLEDGE_UPDATED');

    expect(spy).toHaveBeenCalledWith('ctx_sess_1', 'KNOWLEDGE_UPDATED', undefined);
  });

  it('triggers immediate context refresh when policy is IMMEDIATE', async () => {
    const ctx = createTestProductionRuntime({
      config: { contextRefreshPolicy: 'IMMEDIATE' },
    });
    await ctx.runtime.initialize();
    await ctx.runtime.start();

    const spyRefresh = vi.spyOn(ctx.contextSessionManager, 'refreshContextSession');

    const coordinator = (ctx.runtime as any).coordinator.context;
    await coordinator.markContextStale('ctx_sess_1', 'KNOWLEDGE_UPDATED');

    expect(spyRefresh).toHaveBeenCalledWith('ctx_sess_1', undefined, undefined);
  });

  it('provides new context version upon refresh following knowledge updates', async () => {
    const ctx = createTestProductionRuntime();
    await ctx.runtime.initialize();
    await ctx.runtime.start();

    const refreshResult = await ctx.runtime.refreshContext('ctx_sess_1');
    expect(refreshResult.refreshedVersion).toBe(2);
    expect(refreshResult.previousVersion).toBe(1);
    expect(refreshResult.package).toBeDefined();
  });
});
