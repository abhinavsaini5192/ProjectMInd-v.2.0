import { describe, it, expect } from 'vitest';
import { createContextHarness } from './ContextTestHelper.js';

describe('Context Invalidation & Change Processing', () => {
  it('returns NO_REFRESH_REQUIRED when reported changes do not touch active context', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login request timeout',
    });

    const reportResult = await harness.sessionManager.reportExecution({
      taskId: startResult.task.taskId,
      contextSessionId: startResult.contextSession.contextSessionId,
      status: 'IN_PROGRESS',
      summary: 'Edited unrelated documentation and billing assets',
      modifiedFiles: ['docs/billing/README.md', 'src/billing/InvoiceGenerator.ts'],
    });

    expect(reportResult.invalidation.decision).toBe('NO_REFRESH_REQUIRED');
    expect(reportResult.isStale).toBe(false);

    const state = await harness.sessionManager.getContextState(
      startResult.contextSession.contextSessionId
    );
    expect(state?.freshness).toBe('CURRENT');
  });

  it('marks context PARTIALLY_STALE when changes impact active features', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login request timeout',
    });

    const reportResult = await harness.sessionManager.reportExecution({
      taskId: startResult.task.taskId,
      contextSessionId: startResult.contextSession.contextSessionId,
      status: 'IN_PROGRESS',
      summary: 'Modified AuthService login method',
      modifiedFiles: ['src/auth/AuthService.ts'],
    });

    expect(reportResult.invalidation.decision).toBe('PARTIAL_REFRESH_REQUIRED');
    expect(reportResult.isStale).toBe(true);
    expect(reportResult.invalidation.affectedFeatures).toContain('feat-auth');
    expect(reportResult.invalidation.staleSections).toContain('RESOURCES');

    const state = await harness.sessionManager.getContextState(
      startResult.contextSession.contextSessionId
    );
    expect(state?.freshness).toBe('PARTIALLY_STALE');

    const events = harness.eventBus.published.map((e) => e.event);
    expect(events).toContain('agent.context.invalidated');
    expect(events).toContain('agent.context.session.stale');
  });

  it('marks context STALE on widespread changes across all features', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login request timeout',
    });

    const reportResult = await harness.sessionManager.reportExecution({
      taskId: startResult.task.taskId,
      contextSessionId: startResult.contextSession.contextSessionId,
      status: 'IN_PROGRESS',
      summary: 'Refactored auth, session, and entry points globally',
      modifiedFiles: [
        'src/auth/AuthService.ts',
        'src/auth/AuthController.ts',
        'src/session/SessionService.ts',
      ],
    });

    expect(reportResult.invalidation.decision).toBe('FULL_REFRESH_REQUIRED');
    expect(reportResult.isStale).toBe(true);
  });
});
