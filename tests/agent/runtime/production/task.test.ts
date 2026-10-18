import { describe, it, expect, beforeEach } from 'vitest';
import { createTestProductionRuntime } from './ProductionRuntimeTestHelper.js';

describe('ProductionAgentRuntime - Task Coordination', () => {
  let ctx: ReturnType<typeof createTestProductionRuntime>;
  const scope = {
    workspaceId: 'ws_alpha',
    repositoryId: 'repo_alpha',
    agentSessionId: 'sess_1',
  };

  beforeEach(async () => {
    ctx = createTestProductionRuntime();
    await ctx.runtime.initialize();
    await ctx.runtime.start();
  });

  it('submits a task and tracks active tasks in metrics', async () => {
    const startResult = await ctx.runtime.submitTask(
      {
        ...scope,
        title: 'Refactor Auth Service',
        description: 'Clean up authentication tokens',
        intent: 'Refactor auth',
      },
      scope
    );

    expect(startResult.task.taskId).toBeDefined();
    expect(startResult.task.status).toBe('READY');

    const metrics = ctx.runtime.getMetrics();
    expect(metrics.activeTasks).toBe(1);

    const fetched = await ctx.runtime.getTask(startResult.task.taskId, scope);
    expect(fetched?.taskId).toBe(startResult.task.taskId);
  });

  it('cancels a task and updates active tasks gauge', async () => {
    const startResult = await ctx.runtime.submitTask(
      { ...scope, title: 'Task to cancel', description: 'Desc', intent: 'Cancel' },
      scope
    );

    expect(ctx.runtime.getMetrics().activeTasks).toBe(1);

    const cancelled = await ctx.runtime.cancelTask(
      { taskId: startResult.task.taskId, reason: 'No longer needed' },
      scope
    );

    expect(cancelled.status).toBe('CANCELLED');
    expect(ctx.runtime.getMetrics().activeTasks).toBe(0);
  });

  it('completes a task and records completed metric', async () => {
    const startResult = await ctx.runtime.submitTask(
      { ...scope, title: 'Task to complete', description: 'Desc', intent: 'Complete' },
      scope
    );

    const completed = await ctx.runtime.completeTask(
      { taskId: startResult.task.taskId },
      scope
    );

    expect(completed.status).toBe('COMPLETED');
    expect(ctx.runtime.getMetrics().completedTasks).toBe(1);
    expect(ctx.runtime.getMetrics().activeTasks).toBe(0);
  });
});
