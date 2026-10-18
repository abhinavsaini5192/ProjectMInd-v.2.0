import { describe, it, expect } from 'vitest';
import { createTestTaskRuntime } from './RuntimeTestHelper.js';

describe('Task Completion Validator', () => {
  it('rejects completion when execution and verification reports are missing', async () => {
    const { taskManager, completionValidator } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Incomplete task',
      description: 'Task with no reports',
    });

    const result = await completionValidator.validate(task);
    expect(result.canComplete).toBe(false);
    expect(result.status).toBe('NOT_READY');
    expect(result.missingConditions.some((c) => c.includes('Execution report must be COMPLETED'))).toBe(true);
    expect(result.missingConditions.some((c) => c.includes('Verification report is required'))).toBe(true);
  });

  it('rejects completion when task is in BLOCKED state', async () => {
    const { taskManager, lifecycleManager, completionValidator } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Blocked task',
      description: 'Task in blocked state',
    });

    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'ANALYZING' });
    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'READY' });
    await lifecycleManager.start(task.taskId, 'agent-1');
    const blocked = await lifecycleManager.block(task.taskId, 'Network dependency down', 'agent-1');

    const result = await completionValidator.validate(blocked);
    expect(result.canComplete).toBe(false);
    expect(result.status).toBe('BLOCKED');
  });

  it('approves completion when execution is completed and verification passed', async () => {
    const { taskManager, lifecycleManager, executionCoordinator, verificationCoordinator, completionValidator } =
      createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Full feature',
      description: 'Feature ready for completion',
    });

    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'ANALYZING' });
    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'READY' });
    await lifecycleManager.start(task.taskId, 'agent-1');

    const scope = {
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      agentSessionId: 'session-1',
    };

    // Report completed execution
    await executionCoordinator.reportExecution(
      {
        taskId: task.taskId,
        status: 'COMPLETED',
        summary: 'All code changes committed',
        modifiedFiles: ['src/feature.ts'],
      },
      scope
    );

    // Report passed verification
    await verificationCoordinator.reportVerification(
      {
        taskId: task.taskId,
        passed: true,
        summary: 'Tests and build passed',
        build: { passed: true },
        testCounts: { total: 10, passed: 10, failed: 0, skipped: 0 },
      },
      scope
    );

    const readyTask = (await taskManager.getTask(task.taskId))!;
    const result = await completionValidator.validate(readyTask);

    expect(result.canComplete).toBe(true);
    expect(result.status).toBe('READY_TO_COMPLETE');
    expect(result.missingConditions).toHaveLength(0);
  });

  it('honors relaxed custom policy for documentation tasks', async () => {
    const { taskManager, completionValidator } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Update documentation',
      description: 'Fix typos in README.md',
    });

    const customPolicy = {
      requireExecutionReportComplete: false,
      requireVerificationReport: false,
      requireTestsPassed: false,
      requireBuildPassed: false,
    };

    const result = await completionValidator.validate(task, customPolicy);
    expect(result.canComplete).toBe(true);
    expect(result.status).toBe('READY_TO_COMPLETE');
  });

  it('returns INVALID for already completed or cancelled task', async () => {
    const { taskManager, lifecycleManager, completionValidator } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Cancelled task',
      description: 'Will be cancelled',
    });

    const cancelled = await lifecycleManager.cancel(task.taskId, 'Cancelled by user', 'agent-1');
    const result = await completionValidator.validate(cancelled);

    expect(result.status).toBe('INVALID');
    expect(result.canComplete).toBe(false);
  });
});
