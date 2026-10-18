import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentSessionManager } from '../../src/agent/runtime/AgentSessionManager.js';
import { AgentRegistry } from '../../src/agent/runtime/AgentRegistry.js';
import { AgentCapabilitySet } from '../../src/agent/models/AgentCapabilitySet.js';
import { AgentScopeError } from '../../src/agent/errors/AgentScopeError.js';
import { AgentOperationError } from '../../src/agent/errors/AgentOperationError.js';
import { AgentCapabilityError } from '../../src/agent/errors/AgentCapabilityError.js';
import { AgentSessionNotFoundError } from '../../src/agent/errors/AgentSessionNotFoundError.js';
import { MockEventBus } from './AgentTestHelper.js';

describe('AgentSessionManager', () => {
  let eventBus: MockEventBus;
  let registry: AgentRegistry;
  let sessionManager: AgentSessionManager;

  beforeEach(async () => {
    eventBus = new MockEventBus();
    registry = new AgentRegistry(eventBus);
    sessionManager = new AgentSessionManager(eventBus, { sessionTtlMs: 500 }); // 500ms TTL for testing
  });

  it('creates an active session for an active agent', async () => {
    const agent = await registry.register({
      agentId: 'agent_sess_1',
      name: 'Session Agent',
      type: 'CODING_AGENT',
      version: '1.0',
      capabilities: new AgentCapabilitySet(['CONTEXT_REQUEST', 'FEATURE_QUERY']),
    });

    const session = await sessionManager.createSession(
      {
        agentId: agent.agentId,
        workspaceId: 'ws_test',
        repositoryId: 'repo_test',
        branch: 'main',
        commit: 'abc1234',
        taskId: 'task_001',
      },
      agent
    );

    expect(session.sessionId).toMatch(/^sess_agent_sess_1_/);
    expect(session.agentId).toBe('agent_sess_1');
    expect(session.workspaceId).toBe('ws_test');
    expect(session.repositoryId).toBe('repo_test');
    expect(session.branch).toBe('main');
    expect(session.status).toBe('ACTIVE');
    expect(session.capabilities.has('CONTEXT_REQUEST')).toBe(true);

    const retrieved = await sessionManager.getSession(session.sessionId);
    expect(retrieved).toEqual(session);
  });

  it('restricts session capabilities to a subset of agent capabilities', async () => {
    const agent = await registry.register({
      agentId: 'agent_sess_2',
      name: 'Restricted Agent',
      type: 'CODING_AGENT',
      version: '1.0',
      capabilities: new AgentCapabilitySet(['CONTEXT_REQUEST', 'FEATURE_QUERY']),
    });

    const session = await sessionManager.createSession(
      {
        agentId: agent.agentId,
        workspaceId: 'ws_test',
        repositoryId: 'repo_test',
        requestedCapabilities: ['CONTEXT_REQUEST'],
      },
      agent
    );

    expect(session.capabilities.has('CONTEXT_REQUEST')).toBe(true);
    expect(session.capabilities.has('FEATURE_QUERY')).toBe(false);
  });

  it('rejects session capability request exceeding agent capabilities', async () => {
    const agent = await registry.register({
      agentId: 'agent_sess_3',
      name: 'Agent 3',
      type: 'CODING_AGENT',
      version: '1.0',
      capabilities: new AgentCapabilitySet(['CONTEXT_REQUEST']),
    });

    await expect(
      sessionManager.createSession(
        {
          agentId: agent.agentId,
          workspaceId: 'ws_test',
          repositoryId: 'repo_test',
          requestedCapabilities: ['CONTEXT_REQUEST', 'KNOWLEDGE_UPDATE'],
        },
        agent
      )
    ).rejects.toThrow(AgentCapabilityError);
  });

  it('rejects session creation when agent is not ACTIVE', async () => {
    const agent = await registry.register({
      agentId: 'agent_inactive',
      name: 'Inactive Agent',
      type: 'CODING_AGENT',
      version: '1.0',
    });
    await registry.updateStatus('agent_inactive', 'SUSPENDED');
    const suspendedAgent = (await registry.get('agent_inactive'))!;

    await expect(
      sessionManager.createSession(
        {
          agentId: 'agent_inactive',
          workspaceId: 'ws_test',
          repositoryId: 'repo_test',
        },
        suspendedAgent
      )
    ).rejects.toThrow(AgentOperationError);
  });

  it('rejects session creation without workspaceId or repositoryId', async () => {
    const agent = await registry.register({
      agentId: 'agent_scoped',
      name: 'Scoped Agent',
      type: 'CODING_AGENT',
      version: '1.0',
    });

    await expect(
      sessionManager.createSession(
        {
          agentId: 'agent_scoped',
          workspaceId: '',
          repositoryId: 'repo_test',
        },
        agent
      )
    ).rejects.toThrow(AgentScopeError);

    await expect(
      sessionManager.createSession(
        {
          agentId: 'agent_scoped',
          workspaceId: 'ws_test',
          repositoryId: '',
        },
        agent
      )
    ).rejects.toThrow(AgentScopeError);
  });

  it('updates lastActivityAt upon touchSession', async () => {
    const agent = await registry.register({
      agentId: 'agent_touch',
      name: 'Touch Agent',
      type: 'CODING_AGENT',
      version: '1.0',
    });

    const session = await sessionManager.createSession(
      { agentId: agent.agentId, workspaceId: 'ws_1', repositoryId: 'repo_1' },
      agent
    );

    const initialActivity = session.lastActivityAt;
    // Wait slightly
    await new Promise((r) => setTimeout(r, 10));

    const touched = await sessionManager.touchSession(session.sessionId);
    expect(new Date(touched.lastActivityAt).getTime()).toBeGreaterThanOrEqual(
      new Date(initialActivity).getTime()
    );
  });

  it('expires session after TTL duration', async () => {
    const agent = await registry.register({
      agentId: 'agent_expire',
      name: 'Expire Agent',
      type: 'CODING_AGENT',
      version: '1.0',
    });

    const session = await sessionManager.createSession(
      { agentId: agent.agentId, workspaceId: 'ws_1', repositoryId: 'repo_1' },
      agent
    );

    // Wait for TTL (500ms) to pass
    await new Promise((r) => setTimeout(r, 550));

    const retrieved = await sessionManager.getSession(session.sessionId);
    expect(retrieved?.status).toBe('EXPIRED');
  });

  it('terminates session upon closeSession', async () => {
    const agent = await registry.register({
      agentId: 'agent_close',
      name: 'Close Agent',
      type: 'CODING_AGENT',
      version: '1.0',
    });

    const session = await sessionManager.createSession(
      { agentId: agent.agentId, workspaceId: 'ws_1', repositoryId: 'repo_1' },
      agent
    );

    const closed = await sessionManager.closeSession(session.sessionId, 'Task complete');
    expect(closed).toBe(true);

    const retrieved = await sessionManager.getSession(session.sessionId);
    expect(retrieved?.status).toBe('TERMINATED');
  });

  it('validates session scope matching request context', async () => {
    const agent = await registry.register({
      agentId: 'agent_scope_check',
      name: 'Scope Check Agent',
      type: 'CODING_AGENT',
      version: '1.0',
    });

    const session = await sessionManager.createSession(
      { agentId: agent.agentId, workspaceId: 'ws_valid', repositoryId: 'repo_valid' },
      agent
    );

    // Matching scope succeeds without throwing
    expect(() =>
      sessionManager.validateSessionScope(session, {
        workspaceId: 'ws_valid',
        repositoryId: 'repo_valid',
      })
    ).not.toThrow();

    // Mismatched workspaceId throws AgentScopeError
    expect(() =>
      sessionManager.validateSessionScope(session, {
        workspaceId: 'ws_intruder',
        repositoryId: 'repo_valid',
      })
    ).toThrow(AgentScopeError);

    // Mismatched repositoryId throws AgentScopeError
    expect(() =>
      sessionManager.validateSessionScope(session, {
        workspaceId: 'ws_valid',
        repositoryId: 'repo_intruder',
      })
    ).toThrow(AgentScopeError);
  });
});
