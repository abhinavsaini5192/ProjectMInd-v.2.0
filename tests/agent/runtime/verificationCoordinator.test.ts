import { describe, it, expect } from 'vitest';
import { createTestTaskRuntime, MockEventBus } from './RuntimeTestHelper.js';
import { TaskRuntimeEvents } from '../../../src/agent/runtime/events/TaskRuntimeEvents.js';
import { TaskScopeError } from '../../../src/agent/runtime/errors/TaskRuntimeError.js';

describe('Task Verification Coordinator', () => {
  it('records verification report with AGENT_REPORTED source and advances state', async () => {
    const eventBus = new MockEventBus();
    const { taskManager, lifecycleManager, verificationCoordinator } = createTestTaskRuntime({
      eventBus,
    });

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Run test suite',
      description: 'Run Vitest integration tests',
    });

    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'ANALYZING' });
    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'READY' });
    await lifecycleManager.start(task.taskId, 'agent-1');

    const scope = {
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      agentSessionId: 'session-1',
    };

    const result = await verificationCoordinator.reportVerification(
      {
        taskId: task.taskId,
        passed: true,
        summary: 'All 45 integration tests passed',
        build: { passed: true, details: 'tsc build succeeded' },
        testCounts: { total: 45, passed: 45, failed: 0, skipped: 0 },
        lintDiagnostics: [],
        typecheckDiagnostics: [],
      },
      scope
    );

    expect(result.recorded).toBe(true);
    expect(result.status).toBe('PASSED');
    expect(result.verificationState.verificationSource).toBe('AGENT_REPORTED');
    expect(result.verificationState.tests?.passed).toBe(45);
    expect(result.verificationState.build?.status).toBe('PASSED');

    // Verify task state transitioned to VERIFYING
    const updatedTask = await taskManager.getTask(task.taskId);
    expect(updatedTask?.status).toBe('VERIFYING');

    const verifEvent = eventBus.publishedEvents.find(
      (e) => e.event === TaskRuntimeEvents.TASK_VERIFICATION_REPORTED
    );
    expect(verifEvent).toBeDefined();
    expect((verifEvent?.payload as any).source).toBe('AGENT_REPORTED');
  });

  it('blocks task when reported verification fails', async () => {
    const { taskManager, lifecycleManager, verificationCoordinator } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Failing tests test',
      description: 'Test verification failure handling',
    });

    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'ANALYZING' });
    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'READY' });
    await lifecycleManager.start(task.taskId, 'agent-1');

    const scope = {
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      agentSessionId: 'session-1',
    };

    const result = await verificationCoordinator.reportVerification(
      {
        taskId: task.taskId,
        passed: false,
        summary: '3 tests failed in AuthService.spec.ts',
        testCounts: { total: 10, passed: 7, failed: 3, skipped: 0 },
      },
      scope
    );

    expect(result.status).toBe('FAILED');
    const updatedTask = await taskManager.getTask(task.taskId);
    expect(updatedTask?.status).toBe('BLOCKED');
    expect(updatedTask?.blockedReason).toContain('Verification failed: 3 tests failed');
  });

  it('guarantees idempotency when same operationId is verified twice', async () => {
    const { taskManager, verificationCoordinator } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Idempotency test',
      description: 'Idempotent verification report',
    });

    const scope = {
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      agentSessionId: 'session-1',
    };

    const firstResult = await verificationCoordinator.reportVerification(
      {
        taskId: task.taskId,
        operationId: 'op-verif-99',
        passed: true,
        summary: 'Tests passed',
      },
      scope
    );

    const secondResult = await verificationCoordinator.reportVerification(
      {
        taskId: task.taskId,
        operationId: 'op-verif-99',
        passed: true,
        summary: 'Tests passed again',
      },
      scope
    );

    expect(secondResult.reportId).toBe(firstResult.reportId);
    expect(secondResult.recorded).toBe(true);
  });

  it('enforces scope isolation on verification reporting', async () => {
    const { taskManager, verificationCoordinator } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Scope verification test',
      description: 'Testing scope isolation',
    });

    await expect(
      verificationCoordinator.reportVerification(
        { taskId: task.taskId, passed: true, summary: 'test' },
        { workspaceId: 'ws-1', repositoryId: 'repo-1', agentSessionId: 'unauthorized-session' }
      )
    ).rejects.toThrow(TaskScopeError);
  });
});
