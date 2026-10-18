import { describe, it, expect } from 'vitest';
import { createTestTaskRuntime } from './RuntimeTestHelper.js';
import { STAGE_PROGRESS_PERCENTAGE } from '../../../src/agent/runtime/models/TaskProgress.js';

describe('Task Progress & Timeline Tracking', () => {
  it('calculates deterministic progress stage percentage and extracts completed steps', async () => {
    const { taskManager, lifecycleManager, progressTracker } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Progress Tracking Task',
      description: 'Verifying progress stages',
    });

    // Initial CREATED state
    let progress = await progressTracker.getProgress(task.taskId);
    expect(progress.currentState).toBe('CREATED');
    expect(progress.stagePercentage).toBe(STAGE_PROGRESS_PERCENTAGE.CREATED);
    expect(progress.completedSteps).toContain('Task created');

    // Transition to READY
    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'ANALYZING' });
    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'READY' });
    progress = await progressTracker.getProgress(task.taskId);
    expect(progress.stagePercentage).toBe(STAGE_PROGRESS_PERCENTAGE.READY);

    // Transition to IN_PROGRESS
    await lifecycleManager.start(task.taskId, 'agent-1');
    progress = await progressTracker.getProgress(task.taskId);
    expect(progress.stagePercentage).toBe(STAGE_PROGRESS_PERCENTAGE.IN_PROGRESS);

    // Transition to VERIFYING
    await lifecycleManager.verify(task.taskId, 'agent-1');
    progress = await progressTracker.getProgress(task.taskId);
    expect(progress.stagePercentage).toBe(STAGE_PROGRESS_PERCENTAGE.VERIFYING);

    // Transition to COMPLETED
    await lifecycleManager.complete(task.taskId, 'agent-1');
    progress = await progressTracker.getProgress(task.taskId);
    expect(progress.stagePercentage).toBe(100);
    expect(progress.outstandingConditions).toHaveLength(0);
  });

  it('generates a clean task runtime summary with timeline entries', async () => {
    const { taskManager, lifecycleManager, executionCoordinator, progressTracker } =
      createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Summary Task',
      description: 'Testing task runtime summary',
    });

    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'ANALYZING' });
    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'READY' });
    await lifecycleManager.start(task.taskId, 'agent-1');

    await executionCoordinator.reportExecution(
      {
        taskId: task.taskId,
        status: 'IN_PROGRESS',
        summary: 'Added new auth endpoints',
        modifiedFiles: ['src/routes/auth.ts', 'src/controllers/auth.ts'],
      },
      {
        workspaceId: 'ws-1',
        repositoryId: 'repo-1',
        agentSessionId: 'session-1',
      }
    );

    const summary = await progressTracker.getSummary(task.taskId);
    expect(summary.taskId).toBe(task.taskId);
    expect(summary.title).toBe('Summary Task');
    expect(summary.state).toBe('IN_PROGRESS');
    expect(summary.changedResources).toEqual(
      expect.arrayContaining(['src/routes/auth.ts', 'src/controllers/auth.ts'])
    );
    expect(summary.recentTimeline.length).toBeGreaterThanOrEqual(3);
  });
});
