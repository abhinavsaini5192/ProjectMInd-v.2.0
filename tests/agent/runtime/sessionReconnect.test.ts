import { describe, it, expect } from 'vitest';
import { createTestTaskRuntime } from './RuntimeTestHelper.js';

describe('Session Reconnect & Task Recovery', () => {
  it('preserves task state across session disconnect and restores snapshots on reconnect', async () => {
    const { taskManager, lifecycleManager, taskRuntime } = createTestTaskRuntime();

    const task1 = await taskManager.createTask({
      agentSessionId: 'session-reconnect-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Task 1',
      description: 'First task',
    });
    await lifecycleManager.transition({ taskId: task1.taskId, targetState: 'ANALYZING' });
    await lifecycleManager.transition({ taskId: task1.taskId, targetState: 'READY' });
    await lifecycleManager.start(task1.taskId, 'session-reconnect-1');

    const task2 = await taskManager.createTask({
      agentSessionId: 'session-reconnect-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Task 2',
      description: 'Second task',
    });
    await lifecycleManager.transition({ taskId: task2.taskId, targetState: 'ANALYZING' });
    await lifecycleManager.transition({ taskId: task2.taskId, targetState: 'READY' });
    await lifecycleManager.start(task2.taskId, 'session-reconnect-1');
    await lifecycleManager.block(task2.taskId, 'Blocked on PR review', 'session-reconnect-1');

    // Agent disconnects -> state is preserved
    const storedTask1 = await taskManager.getTask(task1.taskId);
    expect(storedTask1?.status).toBe('IN_PROGRESS');

    // Agent reconnects
    const reconnectResult = await taskRuntime.reconnectSession('session-reconnect-1');
    expect(reconnectResult.activeTasks).toHaveLength(2);
    expect(reconnectResult.snapshots).toHaveLength(2);

    const snapshot1 = reconnectResult.snapshots.find((s) => s.task.taskId === task1.taskId);
    expect(snapshot1?.task.status).toBe('IN_PROGRESS');

    const snapshot2 = reconnectResult.snapshots.find((s) => s.task.taskId === task2.taskId);
    expect(snapshot2?.task.status).toBe('BLOCKED');
    expect(snapshot2?.blockingState?.isBlocked).toBe(true);
  });

  it('recovers a blocked task into IN_PROGRESS and reclaims lease', async () => {
    const { taskManager, lifecycleManager, taskRuntime } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-recovery-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Blocked feature',
      description: 'Need to recover after issue resolved',
    });
    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'ANALYZING' });
    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'READY' });
    await lifecycleManager.start(task.taskId, 'session-recovery-1');
    await lifecycleManager.block(task.taskId, 'Network timeout', 'session-recovery-1');

    const recovery = await taskRuntime.recoverTask(task.taskId, 'session-recovery-1');
    expect(recovery.recovered).toBe(true);
    expect(recovery.task.status).toBe('IN_PROGRESS');
    expect(recovery.snapshot.task.status).toBe('IN_PROGRESS');
  });
});
