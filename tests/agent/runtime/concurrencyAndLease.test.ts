import { describe, it, expect } from 'vitest';
import { createTestTaskRuntime } from './RuntimeTestHelper.js';
import {
  TaskVersionConflictError,
  TaskLeaseConflictError,
} from '../../../src/agent/runtime/errors/TaskRuntimeError.js';

describe('Concurrency & Lease Management', () => {
  it('rejects update with stale taskVersion throwing TaskVersionConflictError', async () => {
    const { taskManager } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Concurrency Task',
      description: 'Test version conflict',
    });

    expect(task.taskVersion).toBe(1);

    // Valid update with expectedVersion: 1 -> version becomes 2
    const updated = await taskManager.updateTask({
      taskId: task.taskId,
      expectedVersion: 1,
      title: 'Updated Concurrency Task',
    });
    expect(updated.taskVersion).toBe(2);

    // Stale update specifying expectedVersion: 1 again must be rejected
    await expect(
      taskManager.updateTask({
        taskId: task.taskId,
        expectedVersion: 1,
        title: 'Conflicting update',
      })
    ).rejects.toThrow(TaskVersionConflictError);
  });

  it('acquires, validates, and prevents concurrent lease hijacking', async () => {
    const { taskManager } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Lease Task',
      description: 'Test lease semantics',
    });

    // Session 1 acquires lease for 1 minute
    const lease1 = await taskManager.acquireLease(task.taskId, 'session-1', 60000);
    expect(lease1.leaseOwner).toBe('session-1');
    expect(lease1.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // Session 2 attempts to claim active lease -> rejected
    await expect(
      taskManager.acquireLease(task.taskId, 'session-2', 60000)
    ).rejects.toThrow(TaskLeaseConflictError);

    // Session 1 can renew its lease
    const renewed = await taskManager.renewLease(task.taskId, 'session-1', 120000);
    expect(renewed.leaseOwner).toBe('session-1');
  });

  it('releases lease and allows another session to claim it', async () => {
    const { taskManager } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Lease Release Task',
      description: 'Test lease release and handoff',
    });

    await taskManager.acquireLease(task.taskId, 'session-1', 60000);
    const released = await taskManager.releaseLease(task.taskId, 'session-1');
    expect(released).toBe(true);

    const taskAfterRelease = await taskManager.getTask(task.taskId);
    expect(taskAfterRelease?.leaseOwner).toBeUndefined();

    // Session 2 can now acquire the lease
    const lease2 = await taskManager.acquireLease(task.taskId, 'session-2', 60000);
    expect(lease2.leaseOwner).toBe('session-2');
  });

  it('allows claiming expired lease by another session', async () => {
    const { taskManager } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Expired Lease Task',
      description: 'Test expired lease claiming',
    });

    // Acquire lease with negative duration (already expired)
    await taskManager.acquireLease(task.taskId, 'session-1', -1000);

    // Session 2 can claim because previous lease is expired
    const lease2 = await taskManager.acquireLease(task.taskId, 'session-2', 60000);
    expect(lease2.leaseOwner).toBe('session-2');
  });
});
