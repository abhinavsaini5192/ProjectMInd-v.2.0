import { describe, it, expect } from 'vitest';
import { createTestTaskRuntime, MockEventBus } from './RuntimeTestHelper.js';
import { TaskScopeError } from '../../../src/agent/runtime/errors/TaskRuntimeError.js';

describe('Task Execution Coordinator', () => {
  it('accepts execution report, normalizes changeSet and updates state', async () => {
    const eventBus = new MockEventBus();
    const { taskManager, executionCoordinator } = createTestTaskRuntime({ eventBus });

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Fix auth',
      description: 'Fix login issue',
    });

    const scope = {
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      agentSessionId: 'session-1',
    };

    const result = await executionCoordinator.reportExecution(
      {
        taskId: task.taskId,
        status: 'IN_PROGRESS',
        summary: 'Updated AuthService credentials validation',
        modifiedFiles: ['src/auth/AuthService.ts'],
      },
      scope
    );

    expect(result.acknowledged).toBe(true);
    expect(result.reportId).toBeDefined();
    expect(result.executionState.executionState).toBe('IN_PROGRESS');
    expect(result.executionState.lastChangeSet?.modifiedResources).toEqual([
      'src/auth/AuthService.ts',
    ]);

    const state = await executionCoordinator.getExecutionState(task.taskId);
    expect(state.summary).toBe('Updated AuthService credentials validation');
  });

  it('handles multiple sequential execution reports without overwriting history', async () => {
    const { taskManager, executionCoordinator, store } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Refactor Services',
      description: 'Refactor auth and session',
    });

    const scope = {
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      agentSessionId: 'session-1',
    };

    // Report 1
    await executionCoordinator.reportExecution(
      {
        taskId: task.taskId,
        status: 'IN_PROGRESS',
        summary: 'Modified AuthService',
        modifiedFiles: ['src/auth/AuthService.ts'],
      },
      scope
    );

    // Report 2
    await executionCoordinator.reportExecution(
      {
        taskId: task.taskId,
        status: 'COMPLETED',
        summary: 'Modified SessionService and completed changes',
        modifiedFiles: ['src/auth/SessionService.ts'],
      },
      scope
    );

    const state = await executionCoordinator.getExecutionState(task.taskId);
    expect(state.executionState).toBe('COMPLETED');
    expect(state.completedAt).toBeDefined();

    const timeline = await store.getTimeline(task.taskId);
    const execEvents = timeline.filter((e) => e.event.startsWith('Execution reported'));
    expect(execEvents).toHaveLength(2);
  });

  it('guarantees idempotency when same operationId is reported twice', async () => {
    const { taskManager, executionCoordinator } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Idempotency test',
      description: 'Testing idempotent execution report',
    });

    const scope = {
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      agentSessionId: 'session-1',
    };

    const firstResult = await executionCoordinator.reportExecution(
      {
        taskId: task.taskId,
        operationId: 'op-dedup-123',
        status: 'IN_PROGRESS',
        summary: 'Updating config file',
        modifiedFiles: ['config/default.json'],
      },
      scope
    );

    const secondResult = await executionCoordinator.reportExecution(
      {
        taskId: task.taskId,
        operationId: 'op-dedup-123',
        status: 'IN_PROGRESS',
        summary: 'Updating config file again',
        modifiedFiles: ['config/default.json'],
      },
      scope
    );

    expect(secondResult.reportId).toBe(firstResult.reportId);
    expect(secondResult.acknowledged).toBe(true);
  });

  it('enforces scope and ownership checks', async () => {
    const { taskManager, executionCoordinator } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Scope test',
      description: 'Test scope enforcement',
    });

    // Cross-workspace
    await expect(
      executionCoordinator.reportExecution(
        { taskId: task.taskId, status: 'IN_PROGRESS', summary: 'test' },
        { workspaceId: 'ws-other', repositoryId: 'repo-1', agentSessionId: 'session-1' }
      )
    ).rejects.toThrow(TaskScopeError);

    // Cross-session
    await expect(
      executionCoordinator.reportExecution(
        { taskId: task.taskId, status: 'IN_PROGRESS', summary: 'test' },
        { workspaceId: 'ws-1', repositoryId: 'repo-1', agentSessionId: 'session-other' }
      )
    ).rejects.toThrow(TaskScopeError);
  });
});
