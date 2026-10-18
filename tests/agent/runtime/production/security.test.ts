import { describe, it, expect, beforeEach } from 'vitest';
import { createTestProductionRuntime, createMockAgent } from './ProductionRuntimeTestHelper.js';
import { RuntimeScopeError } from '../../../../src/agent/runtime/errors/AgentRuntimeError.js';

describe('ProductionAgentRuntime - Security & Tenant Isolation', () => {
  let ctx: ReturnType<typeof createTestProductionRuntime>;
  const agent = createMockAgent();

  beforeEach(async () => {
    ctx = createTestProductionRuntime();
    await ctx.runtime.initialize();
    await ctx.runtime.start();
  });

  it('rejects access to a session from a mismatched workspaceId', async () => {
    const session = await ctx.runtime.createSession(
      { workspaceId: 'tenant-a', repositoryId: 'repo-1', agentId: agent.agentId },
      agent
    );

    await expect(
      ctx.runtime.getSession(session.sessionId, { workspaceId: 'tenant-b' })
    ).rejects.toThrow(RuntimeScopeError);
  });

  it('rejects access to a session from a mismatched repositoryId', async () => {
    const session = await ctx.runtime.createSession(
      { workspaceId: 'tenant-a', repositoryId: 'repo-1', agentId: agent.agentId },
      agent
    );

    await expect(
      ctx.runtime.getSession(session.sessionId, { repositoryId: 'repo-2' })
    ).rejects.toThrow(RuntimeScopeError);
  });

  it('permits access when workspace and repository match exactly', async () => {
    const session = await ctx.runtime.createSession(
      { workspaceId: 'tenant-a', repositoryId: 'repo-1', agentId: agent.agentId },
      agent
    );

    const retrieved = await ctx.runtime.getSession(session.sessionId, {
      workspaceId: 'tenant-a',
      repositoryId: 'repo-1',
    });

    expect(retrieved).toBeDefined();
    expect(retrieved?.sessionId).toBe(session.sessionId);
  });

  it('validates tool permission based on session status', () => {
    const coordinator = (ctx.runtime as any).coordinator.tools;

    const activeSession: any = { status: 'ACTIVE' };
    expect(coordinator.validatePermissions('projectmind_get_context', activeSession)).toBe(true);

    const terminatedSession: any = { status: 'TERMINATED' };
    expect(coordinator.validatePermissions('projectmind_get_context', terminatedSession)).toBe(false);
  });
});
