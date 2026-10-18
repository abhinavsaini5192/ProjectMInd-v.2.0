import { describe, it, expect } from 'vitest';
import { createContextHarness } from '../context/ContextTestHelper.js';
import { createTestTaskRuntime, createMockAgentSession, MockEventBus } from './RuntimeTestHelper.js';

describe('Phase 7.5 End-to-End Scenario (Section 45): Fix login request timeout', () => {
  it('coordinates full agent task lifecycle without autonomous code execution', async () => {
    // 1. Setup Context & Agent Session
    const contextHarness = createContextHarness();
    const eventBus = new MockEventBus();
    const agentSession = createMockAgentSession({
      sessionId: 'sess-claude-timeout-fix',
      workspaceId: 'ws-mind-1',
      repositoryId: 'repo-mind-1',
    });

    const { taskRuntime, store } = createTestTaskRuntime({
      eventBus,
      contextSessionManager: contextHarness.sessionManager,
    });

    const scope = {
      workspaceId: agentSession.workspaceId,
      repositoryId: agentSession.repositoryId,
      agentSessionId: agentSession.sessionId,
    };

    // =========================================================================
    // Steps 1 - 5: Start Task -> Create Task, Context Session, Package, IN_PROGRESS
    // =========================================================================
    const startResult = await taskRuntime.startTask(
      {
        agentSessionId: agentSession.sessionId,
        workspaceId: agentSession.workspaceId,
        repositoryId: agentSession.repositoryId,
        title: 'Fix login request timeout.',
        description: 'Resolve token refresh timeout in auth service',
        intent: 'DEBUGGING',
        featureIds: ['feat-auth'],
      },
      scope
    );

    const task = startResult.task;
    expect(task.taskId).toBeDefined();
    expect(task.status).toBe('IN_PROGRESS'); // Step 5: enters IN_PROGRESS
    expect(startResult.contextSession).toBeDefined(); // Step 3: Context session created
    expect(startResult.contextPackage).toBeDefined(); // Step 4: Context package generated
    expect(startResult.contextVersion).toBe(1);

    // =========================================================================
    // Steps 6 - 10: Agent modifies AuthService -> Reports Execution -> Normalizes ChangeSet -> Impact Analysis -> Context becomes stale
    // =========================================================================
    const execReportResult1 = await taskRuntime.reportExecution(
      {
        taskId: task.taskId,
        status: 'IN_PROGRESS',
        summary: 'Updated AuthService with timeout extension and exponential retry',
        modifiedFiles: ['src/auth/AuthService.ts'],
        operationId: 'op-mod-auth-1',
      },
      scope
    );

    expect(execReportResult1.acknowledged).toBe(true);
    // Step 8: normalized ChangeSet
    expect(execReportResult1.executionState.lastChangeSet?.modifiedResources).toContain(
      'src/auth/AuthService.ts'
    );
    // Step 9 & 10: Invalidation decision identifies impact
    expect(execReportResult1.invalidationDecision).toBe('PARTIAL_REFRESH_REQUIRED');

    // Context session status should now be STALE
    const ctxSessionAfterExec = await contextHarness.sessionManager.getContextSession(
      startResult.contextSession.contextSessionId
    );
    expect(ctxSessionAfterExec?.status).toBe('STALE');

    // =========================================================================
    // Steps 11 - 12: Agent requests refreshed context -> Context Version increments
    // =========================================================================
    const refreshResult = await contextHarness.sessionManager.getCurrentContext(
      startResult.contextSession.contextSessionId,
      { autoRefreshIfStale: true }
    );
    expect(refreshResult.wasRefreshed).toBe(true);
    expect(refreshResult.contextVersion).toBe(2); // Step 12: Context Version increments

    // =========================================================================
    // Step 13: Agent updates SessionService and reports completed execution
    // =========================================================================
    const execReportResult2 = await taskRuntime.reportExecution(
      {
        taskId: task.taskId,
        status: 'COMPLETED',
        summary: 'Updated SessionService to handle extended timeout gracefully',
        modifiedFiles: ['src/session/SessionService.ts'],
        operationId: 'op-mod-session-2',
      },
      scope
    );
    expect(execReportResult2.executionState.executionState).toBe('COMPLETED');

    // =========================================================================
    // Steps 14 - 16: Agent reports verification (Tests = PASSED, Build = PASSED)
    // =========================================================================
    const verifResult = await taskRuntime.reportVerification(
      {
        taskId: task.taskId,
        passed: true,
        summary: 'All login unit & integration tests pass with 200ms avg response',
        build: { passed: true, details: 'tsc compile success' },
        testCounts: { total: 24, passed: 24, failed: 0, skipped: 0 },
        operationId: 'op-verif-final-3',
      },
      scope
    );

    expect(verifResult.status).toBe('PASSED');
    // Enforce trust boundary
    expect(verifResult.verificationState.verificationSource).toBe('AGENT_REPORTED');
    expect(verifResult.verificationState.tests?.status).toBe('PASSED');
    expect(verifResult.verificationState.build?.status).toBe('PASSED');

    // Task entered VERIFYING
    const verifyingTask = await taskRuntime.getTask(task.taskId, scope);
    expect(verifyingTask?.status).toBe('VERIFYING');

    // =========================================================================
    // Steps 17 - 19: Completion validator checks conditions -> Task COMPLETED -> Context session finalized
    // =========================================================================
    const completedTask = await taskRuntime.completeTask(
      {
        taskId: task.taskId,
        reason: 'Bug resolved, verified, ready for deployment',
      },
      scope
    );

    expect(completedTask.status).toBe('COMPLETED');
    expect(completedTask.completedAt).toBeDefined();

    // Context session finalized (status: COMPLETED)
    const finalizedCtx = await contextHarness.sessionManager.getContextSession(
      startResult.contextSession.contextSessionId
    );
    expect(finalizedCtx?.status).toBe('COMPLETED');

    // Lease released
    const activeLease = await store.getLease(task.taskId);
    expect(activeLease).toBeUndefined();

    // =========================================================================
    // Step 20: Timeline contains the complete task history
    // =========================================================================
    const timeline = await store.getTimeline(task.taskId);
    const eventNames = timeline.map((t) => t.event);

    expect(eventNames).toContain('Task created');
    expect(eventNames.some((e) => e.includes('IN_PROGRESS'))).toBe(true);
    expect(eventNames.some((e) => e.includes('Execution reported'))).toBe(true);
    expect(eventNames.some((e) => e.includes('Verification reported'))).toBe(true);
    expect(eventNames.some((e) => e.includes('COMPLETED'))).toBe(true);
  });
});
