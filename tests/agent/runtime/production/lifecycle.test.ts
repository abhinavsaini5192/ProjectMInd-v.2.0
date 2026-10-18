import { describe, it, expect, beforeEach } from 'vitest';
import { createTestProductionRuntime, createMockAgent } from './ProductionRuntimeTestHelper.js';
import { RuntimeNotReadyError, RuntimeStateError } from '../../../../src/agent/runtime/errors/AgentRuntimeError.js';
import { AgentRuntimeEvents } from '../../../../src/agent/runtime/events/AgentRuntimeEvents.js';

describe('ProductionAgentRuntime - Lifecycle & State Machine', () => {
  let ctx: ReturnType<typeof createTestProductionRuntime>;

  beforeEach(() => {
    ctx = createTestProductionRuntime();
  });

  it('starts in CREATED state and rejects operations before initialization', async () => {
    expect(ctx.runtime.getState()).toBe('CREATED');

    const agent = createMockAgent();
    await expect(
      ctx.runtime.createSession({ workspaceId: 'ws_1', repositoryId: 'repo_1', agentId: agent.agentId }, agent)
    ).rejects.toThrow(RuntimeNotReadyError);
  });

  it('transitions from CREATED to READY upon initialize() and publishes event', async () => {
    await ctx.runtime.initialize();
    expect(ctx.runtime.getState()).toBe('READY');

    const readyEvent = ctx.eventBus.publishedEvents.find(
      (e) => e.eventName === AgentRuntimeEvents.RUNTIME_READY
    );
    expect(readyEvent).toBeDefined();
    expect((readyEvent?.payload as any).currentState).toBe('READY');
  });

  it('transitions to RUNNING upon start()', async () => {
    await ctx.runtime.initialize();
    await ctx.runtime.start();
    expect(ctx.runtime.getState()).toBe('RUNNING');
  });

  it('pauses and resumes, rejecting operations while paused', async () => {
    await ctx.runtime.initialize();
    await ctx.runtime.start();

    await ctx.runtime.pause('Maintenance window');
    expect(ctx.runtime.getState()).toBe('PAUSED');

    const agent = createMockAgent();
    await expect(
      ctx.runtime.createSession({ workspaceId: 'ws_1', repositoryId: 'repo_1', agentId: agent.agentId }, agent)
    ).rejects.toThrow(RuntimeNotReadyError);

    await ctx.runtime.resume();
    expect(ctx.runtime.getState()).toBe('RUNNING');
  });

  it('transitions to STOPPED upon stop() and terminates operations', async () => {
    await ctx.runtime.initialize();
    await ctx.runtime.start();
    await ctx.runtime.stop('Normal shutdown');
    expect(ctx.runtime.getState()).toBe('STOPPED');

    const stoppedEvent = ctx.eventBus.publishedEvents.find(
      (e) => e.eventName === AgentRuntimeEvents.RUNTIME_STOPPED
    );
    expect(stoppedEvent).toBeDefined();
  });

  it('reports status, health, metrics, and capabilities correctly', async () => {
    await ctx.runtime.initialize();
    const status = await ctx.runtime.getStatus();
    expect(status.state).toBe('READY');
    expect(status.runtimeVersion).toBe('1.0.0');

    const health = await ctx.runtime.getHealth();
    expect(health.status).toBe('HEALTHY');

    const metrics = ctx.runtime.getMetrics();
    expect(metrics.activeSessions).toBe(0);

    const caps = ctx.runtime.getCapabilities();
    expect(caps.multiSession).toBe(true);
    expect(caps.recovery).toBe(true);
  });
});
