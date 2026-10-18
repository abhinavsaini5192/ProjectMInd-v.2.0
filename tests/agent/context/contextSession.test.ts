import { describe, it, expect } from 'vitest';
import { createContextHarness } from './ContextTestHelper.js';
import { ContextSessionNotFoundError } from '../../../src/agent/context/errors/AgentContextError.js';

describe('Agent Context Session Lifecycle', () => {
  it('creates and retrieves active context session with initial version 1', async () => {
    const harness = createContextHarness();
    const result = await harness.sessionManager.startTaskContext({
      agentSessionId: 'agent-session-123',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Improve query performance for user dashboard',
    });

    expect(result.contextSession.contextSessionId).toMatch(/^cs_/);
    expect(result.contextSession.status).toBe('ACTIVE');
    expect(result.contextSession.currentContextVersion).toBe(1);

    const retrieved = await harness.sessionManager.getContextSession(
      result.contextSession.contextSessionId
    );
    expect(retrieved).toBeDefined();
    expect(retrieved?.contextSessionId).toBe(result.contextSession.contextSessionId);
    expect(retrieved?.currentContextVersion).toBe(1);
  });

  it('pauses and resumes context session', async () => {
    const harness = createContextHarness();
    const result = await harness.sessionManager.startTaskContext({
      agentSessionId: 'agent-session-123',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Debug login issues',
    });

    const paused = await harness.sessionManager.pauseContextSession(
      result.contextSession.contextSessionId
    );
    expect(paused.status).toBe('PAUSED');

    const resumed = await harness.sessionManager.resumeContextSession(
      result.contextSession.contextSessionId
    );
    expect(resumed.status).toBe('ACTIVE');
  });

  it('marks context session as stale', async () => {
    const harness = createContextHarness();
    const result = await harness.sessionManager.startTaskContext({
      agentSessionId: 'agent-session-123',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Update payment webhook handlers',
    });

    await harness.sessionManager.markContextStale(
      result.contextSession.contextSessionId,
      'KNOWLEDGE_UPDATED'
    );

    const session = await harness.sessionManager.getContextSession(
      result.contextSession.contextSessionId
    );
    expect(session?.status).toBe('STALE');

    const state = await harness.sessionManager.getContextState(
      result.contextSession.contextSessionId
    );
    expect(state?.freshness).toBe('STALE');
    expect(state?.lastRefreshReason).toBe('KNOWLEDGE_UPDATED');

    const events = harness.eventBus.published.map((e) => e.event);
    expect(events).toContain('agent.context.session.stale');
  });

  it('throws ContextSessionNotFoundError when querying non-existent session', async () => {
    const harness = createContextHarness();
    await expect(
      harness.sessionManager.getCurrentContext('cs_non_existent')
    ).rejects.toThrow(ContextSessionNotFoundError);
  });
});
