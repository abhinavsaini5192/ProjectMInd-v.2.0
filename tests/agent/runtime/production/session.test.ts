import { describe, it, expect, beforeEach } from 'vitest';
import { createTestProductionRuntime, createMockAgent } from './ProductionRuntimeTestHelper.js';
import { RuntimeScopeError } from '../../../../src/agent/runtime/errors/AgentRuntimeError.js';

describe('ProductionAgentRuntime - Session Coordination', () => {
  let ctx: ReturnType<typeof createTestProductionRuntime>;
  const agent = createMockAgent();

  beforeEach(async () => {
    ctx = createTestProductionRuntime();
    await ctx.runtime.initialize();
    await ctx.runtime.start();
  });

  it('creates, retrieves, and lists active sessions', async () => {
    const session = await ctx.runtime.createSession(
      { workspaceId: 'ws_alpha', repositoryId: 'repo_alpha', agentId: agent.agentId },
      agent
    );

    expect(session.sessionId).toBeDefined();
    expect(session.workspaceId).toBe('ws_alpha');

    const fetched = await ctx.runtime.getSession(session.sessionId, { workspaceId: 'ws_alpha' });
    expect(fetched?.sessionId).toBe(session.sessionId);

    const activeList = await ctx.runtime.listActiveSessions('ws_alpha');
    expect(activeList.length).toBe(1);
    expect(activeList[0]!.sessionId).toBe(session.sessionId);

    const metrics = ctx.runtime.getMetrics();
    expect(metrics.activeSessions).toBe(1);
  });

  it('enforces multi-tenant workspace isolation on session access', async () => {
    const session = await ctx.runtime.createSession(
      { workspaceId: 'ws_alpha', repositoryId: 'repo_alpha', agentId: agent.agentId },
      agent
    );

    await expect(
      ctx.runtime.getSession(session.sessionId, { workspaceId: 'ws_beta' })
    ).rejects.toThrow(RuntimeScopeError);
  });

  it('terminates sessions and updates active session gauge', async () => {
    const session = await ctx.runtime.createSession(
      { workspaceId: 'ws_alpha', repositoryId: 'repo_alpha', agentId: agent.agentId },
      agent
    );

    expect(ctx.runtime.getMetrics().activeSessions).toBe(1);

    await ctx.runtime.terminateSession(session.sessionId, { workspaceId: 'ws_alpha' });

    const activeList = await ctx.runtime.listActiveSessions('ws_alpha');
    expect(activeList.length).toBe(0);
    expect(ctx.runtime.getMetrics().activeSessions).toBe(0);
  });
});
