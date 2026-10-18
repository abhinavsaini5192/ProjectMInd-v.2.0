import { describe, it, expect } from 'vitest';
import { createTestTaskRuntime } from './RuntimeTestHelper.js';
import {
  TaskScopeError,
  TaskLeaseConflictError,
} from '../../../src/agent/runtime/errors/TaskRuntimeError.js';

describe('Security & Scope Isolation', () => {
  it('strictly isolates tasks across workspaces', async () => {
    const { taskRuntime } = createTestTaskRuntime();

    // Start task in workspace A
    const started = await taskRuntime.startTask(
      {
        agentSessionId: 'session-ws-a',
        workspaceId: 'ws-alpha',
        repositoryId: 'repo-1',
        title: 'Alpha Task',
        description: 'Work inside Alpha',
      },
      {
        workspaceId: 'ws-alpha',
        repositoryId: 'repo-1',
        agentSessionId: 'session-ws-a',
      }
    );

    // Attempt to access task from workspace B
    await expect(
      taskRuntime.getTask(started.task.taskId, {
        workspaceId: 'ws-beta',
        repositoryId: 'repo-1',
        agentSessionId: 'session-ws-b',
      })
    ).rejects.toThrow(TaskScopeError);

    // Attempt to report execution from workspace B
    await expect(
      taskRuntime.reportExecution(
        {
          taskId: started.task.taskId,
          status: 'IN_PROGRESS',
          summary: 'Tampering attempt',
        },
        {
          workspaceId: 'ws-beta',
          repositoryId: 'repo-1',
          agentSessionId: 'session-ws-b',
        }
      )
    ).rejects.toThrow(TaskScopeError);
  });

  it('strictly isolates tasks across repositories', async () => {
    const { taskRuntime } = createTestTaskRuntime();

    const started = await taskRuntime.startTask(
      {
        agentSessionId: 'session-repo-a',
        workspaceId: 'ws-1',
        repositoryId: 'repo-frontend',
        title: 'Frontend Task',
        description: 'React frontend task',
      },
      {
        workspaceId: 'ws-1',
        repositoryId: 'repo-frontend',
        agentSessionId: 'session-repo-a',
      }
    );

    await expect(
      taskRuntime.getTask(started.task.taskId, {
        workspaceId: 'ws-1',
        repositoryId: 'repo-backend',
        agentSessionId: 'session-repo-b',
      })
    ).rejects.toThrow(TaskScopeError);
  });

  it('prevents an unauthorized session from completing or cancelling another session task', async () => {
    const { taskRuntime } = createTestTaskRuntime();

    const started = await taskRuntime.startTask(
      {
        agentSessionId: 'session-owner',
        workspaceId: 'ws-1',
        repositoryId: 'repo-1',
        title: 'Sensitive Task',
        description: 'Important task',
      },
      {
        workspaceId: 'ws-1',
        repositoryId: 'repo-1',
        agentSessionId: 'session-owner',
      }
    );

    // Rogue session attempts completion
    await expect(
      taskRuntime.completeTask(
        { taskId: started.task.taskId },
        {
          workspaceId: 'ws-1',
          repositoryId: 'repo-1',
          agentSessionId: 'session-rogue',
        }
      )
    ).rejects.toThrow(TaskScopeError);

    // Rogue session attempts cancellation
    await expect(
      taskRuntime.cancelTask(
        { taskId: started.task.taskId, reason: 'Malicious cancellation' },
        {
          workspaceId: 'ws-1',
          repositoryId: 'repo-1',
          agentSessionId: 'session-rogue',
        }
      )
    ).rejects.toThrow(TaskScopeError);
  });
});
