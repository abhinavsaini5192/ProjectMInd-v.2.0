import { describe, it, expect, beforeEach } from 'vitest';
import { createTestProductionRuntime, createMockAgent } from './ProductionRuntimeTestHelper.js';
import { AgentRuntimeEvents } from '../../../../src/agent/runtime/events/AgentRuntimeEvents.js';

describe('ProductionAgentRuntime - Recovery & Checkpointing', () => {
  let ctx: ReturnType<typeof createTestProductionRuntime>;
  const agent = createMockAgent();

  beforeEach(async () => {
    ctx = createTestProductionRuntime();
    await ctx.runtime.initialize();
    await ctx.runtime.start();
  });

  it('creates, lists, and retrieves runtime checkpoints', async () => {
    // Create a session so checkpoint contains state
    await ctx.runtime.createSession(
      { workspaceId: 'ws_alpha', repositoryId: 'repo_alpha', agentId: agent.agentId },
      agent
    );

    const checkpoint = await ctx.runtime.createCheckpoint('pre-refactor snapshot');
    expect(checkpoint.checkpointId).toBeDefined();
    expect(checkpoint.metadata?.label).toBe('pre-refactor snapshot');
    expect(checkpoint.activeSessionIds.length).toBe(1);

    const chkManager = (ctx.runtime as any).coordinator.checkpoints;
    const list = await chkManager.listCheckpoints();
    expect(list.length).toBe(1);
    expect(list[0]!.checkpointId).toBe(checkpoint.checkpointId);

    const fetched = await chkManager.getCheckpoint(checkpoint.checkpointId);
    expect(fetched?.checkpointId).toBe(checkpoint.checkpointId);
  });

  it('restores checkpoint and produces structured recovery state', async () => {
    const checkpoint = await ctx.runtime.createCheckpoint('snapshot-1');

    const recoveryState = await ctx.runtime.restoreCheckpoint(checkpoint.checkpointId);
    expect(recoveryState.status).toBe('RECOVERED');
    expect(recoveryState.checkpointId).toBe(checkpoint.checkpointId);
    expect(recoveryState.contextRefreshed).toBe(true);
  });

  it('executes full recovery sequence and publishes recovery events', async () => {
    const checkpoint = await ctx.runtime.createCheckpoint('recovery-target');

    const recoveryResult = await ctx.runtime.recover(checkpoint.checkpointId);
    expect(recoveryResult.status).toBe('RECOVERED');
    expect(recoveryResult.recoveredSessionsCount).toBe(checkpoint.activeSessionIds.length);

    // State returns to READY after recovery
    expect(ctx.runtime.getState()).toBe('READY');

    const recoveryEvent = ctx.eventBus.publishedEvents.find(
      (e) => e.eventName === AgentRuntimeEvents.RUNTIME_RECOVERED
    );
    expect(recoveryEvent).toBeDefined();
  });

  it('prunes old checkpoints when capacity is exceeded', async () => {
    const chkManager = (ctx.runtime as any).coordinator.checkpoints;
    await ctx.runtime.createCheckpoint('snap-1');
    await ctx.runtime.createCheckpoint('snap-2');
    await ctx.runtime.createCheckpoint('snap-3');

    const prunedCount = await chkManager.pruneCheckpoints(1);
    expect(prunedCount).toBe(2);

    const remaining = await chkManager.listCheckpoints();
    expect(remaining.length).toBe(1);
  });
});
