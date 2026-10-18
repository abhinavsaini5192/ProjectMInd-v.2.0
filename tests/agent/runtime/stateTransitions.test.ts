import { describe, it, expect } from 'vitest';
import { createTestTaskRuntime } from './RuntimeTestHelper.js';
import { TaskLifecycleError } from '../../../src/agent/runtime/errors/TaskRuntimeError.js';
import { TaskTransitionValidator } from '../../../src/agent/runtime/services/TaskTransitionValidator.js';

describe('Task State Transition Validation', () => {
  it('allows same-state transition without throwing', () => {
    expect(() => TaskTransitionValidator.validate('IN_PROGRESS', 'IN_PROGRESS')).not.toThrow();
  });

  it('strictly rejects reopening COMPLETED tasks', () => {
    expect(() => TaskTransitionValidator.validate('COMPLETED', 'IN_PROGRESS')).toThrow(
      TaskLifecycleError
    );
    expect(() => TaskTransitionValidator.validate('COMPLETED', 'READY')).toThrow(
      TaskLifecycleError
    );
  });

  it('strictly rejects transitioning from CANCELLED state', () => {
    expect(() => TaskTransitionValidator.validate('CANCELLED', 'IN_PROGRESS')).toThrow(
      TaskLifecycleError
    );
  });

  it('rejects illegal jumps in the lifecycle matrix', () => {
    // CREATED cannot jump directly to COMPLETED or VERIFYING
    expect(() => TaskTransitionValidator.validate('CREATED', 'COMPLETED')).toThrow(
      TaskLifecycleError
    );
    expect(() => TaskTransitionValidator.validate('CREATED', 'VERIFYING')).toThrow(
      TaskLifecycleError
    );

    // READY cannot jump directly to COMPLETED
    expect(() => TaskTransitionValidator.validate('READY', 'COMPLETED')).toThrow(
      TaskLifecycleError
    );
  });

  it('rejects transition to BLOCKED, FAILED, or CANCELLED without valid reason', () => {
    expect(() => TaskTransitionValidator.validate('IN_PROGRESS', 'BLOCKED')).toThrow(
      TaskLifecycleError
    );
    expect(() => TaskTransitionValidator.validate('IN_PROGRESS', 'BLOCKED', '   ')).toThrow(
      TaskLifecycleError
    );

    expect(() => TaskTransitionValidator.validate('IN_PROGRESS', 'FAILED')).toThrow(
      TaskLifecycleError
    );

    expect(() => TaskTransitionValidator.validate('IN_PROGRESS', 'CANCELLED')).toThrow(
      TaskLifecycleError
    );
  });

  it('throws TaskLifecycleError when attempting illegal transition via TaskLifecycleManager', async () => {
    const { taskManager, lifecycleManager } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Illegal transition test',
      description: 'Test illegal transition rejection',
    });

    await expect(
      lifecycleManager.transition({
        taskId: task.taskId,
        targetState: 'COMPLETED',
      })
    ).rejects.toThrow(TaskLifecycleError);
  });
});
