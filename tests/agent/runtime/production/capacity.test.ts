import { describe, it, expect, beforeEach } from 'vitest';
import { createTestProductionRuntime, createMockAgent } from './ProductionRuntimeTestHelper.js';
import { RuntimeCapacityError } from '../../../../src/agent/runtime/errors/AgentRuntimeError.js';

describe('ProductionAgentRuntime - Capacity Limits & Backpressure', () => {
  let ctx: ReturnType<typeof createTestProductionRuntime>;
  const agent = createMockAgent();

  beforeEach(async () => {
    ctx = createTestProductionRuntime({
      config: {
        limits: {
          ...({} as any),
          maxConcurrentSessions: 2,
          maxConcurrentTasks: 2,
        },
      },
    });
    await ctx.runtime.initialize();
    await ctx.runtime.start();
  });

  it('rejects session creation when maxConcurrentSessions limit is reached', async () => {
    await ctx.runtime.createSession(
      { workspaceId: 'ws_1', repositoryId: 'repo_1', agentId: agent.agentId },
      agent
    );
    await ctx.runtime.createSession(
      { workspaceId: 'ws_1', repositoryId: 'repo_1', agentId: agent.agentId },
      agent
    );

    // 3rd session should be rejected
    await expect(
      ctx.runtime.createSession(
        { workspaceId: 'ws_1', repositoryId: 'repo_1', agentId: agent.agentId },
        agent
      )
    ).rejects.toThrow(RuntimeCapacityError);

    const metrics = ctx.runtime.getMetrics();
    expect(metrics.errorsCount).toBe(1);
  });

  it('rejects task submission when maxConcurrentTasks limit is reached', async () => {
    const scope = {
      workspaceId: 'ws_1',
      repositoryId: 'repo_1',
      agentSessionId: 'sess_1',
    };

    await ctx.runtime.submitTask({ ...scope, title: 'Task 1', description: 'D1', intent: 'I1' }, scope);
    await ctx.runtime.submitTask({ ...scope, title: 'Task 2', description: 'D2', intent: 'I2' }, scope);

    // 3rd task should be rejected
    await expect(
      ctx.runtime.submitTask({ ...scope, title: 'Task 3', description: 'D3', intent: 'I3' }, scope)
    ).rejects.toThrow(RuntimeCapacityError);

    const metrics = ctx.runtime.getMetrics();
    expect(metrics.errorsCount).toBe(1);
  });
});
