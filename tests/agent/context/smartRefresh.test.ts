import { describe, it, expect } from 'vitest';
import { createContextHarness } from './ContextTestHelper.js';

describe('Smart Context Refresh', () => {
  it('rebuilds affected sections while reusing unaffected sections', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login request timeout',
    });

    const refreshResult = await harness.sessionManager.refreshContextSession(
      startResult.contextSession.contextSessionId,
      {
        reason: 'RESOURCE_CHANGED',
        modifiedFiles: ['src/auth/AuthService.ts'],
        affectedFeatures: ['feat-auth'],
        staleSections: ['RESOURCES', 'BEHAVIOR'],
      }
    );

    expect(refreshResult.previousVersion).toBe(1);
    expect(refreshResult.refreshedVersion).toBe(2);
    expect(refreshResult.reason).toBe('RESOURCE_CHANGED');
    expect(refreshResult.rebuiltSections).toContain('RESOURCES');
    expect(refreshResult.rebuiltSections).toContain('BEHAVIOR');
    expect(refreshResult.reusedSections).toContain('ARCHITECTURE');

    // Context version incremented in session
    const session = await harness.sessionManager.getContextSession(
      startResult.contextSession.contextSessionId
    );
    expect(session?.currentContextVersion).toBe(2);

    // Context package packageId reflects version 2
    expect(refreshResult.package.packageId).toContain('_v2');
  });

  it('supports explicit full refresh when requested', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login request timeout',
    });

    const refreshResult = await harness.sessionManager.refreshContextSession(
      startResult.contextSession.contextSessionId,
      {
        reason: 'EXPLICIT_REQUEST',
        forceFullRefresh: true,
      }
    );

    expect(refreshResult.previousVersion).toBe(1);
    expect(refreshResult.refreshedVersion).toBe(2);
    expect(refreshResult.rebuiltSections).toContain('ALL');
    expect(refreshResult.reusedSections).toHaveLength(0);
  });

  it('emits agent.context.refreshed event on bus', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login request timeout',
    });

    await harness.sessionManager.refreshContextSession(
      startResult.contextSession.contextSessionId,
      {
        reason: 'FEATURE_CHANGED',
      }
    );

    const refreshEvent = harness.eventBus.published.find(
      (e) => e.event === 'agent.context.refreshed'
    );
    expect(refreshEvent).toBeDefined();
    expect(refreshEvent?.payload?.data?.refreshedVersion).toBe(2);
    expect(refreshEvent?.payload?.data?.reason).toBe('FEATURE_CHANGED');
  });
});
