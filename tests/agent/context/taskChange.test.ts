import { describe, it, expect } from 'vitest';
import { createContextHarness } from './ContextTestHelper.js';

describe('Task Scope Refinement & Feature Transitions', () => {
  it('updates task goals and dynamically recalculates context relevance', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix login timeout',
      taskIntent: 'DEBUGGING',
    });

    // Agent expands task: "Fix login timeout and token refresh failures"
    const updateResult = await harness.sessionManager.updateTaskContext(
      startResult.contextSession.contextSessionId,
      {
        newTaskText: 'Fix login timeout and token refresh failures',
        newIntent: 'IMPLEMENTATION',
        featureIds: ['feat-auth', 'feat-session'],
      }
    );

    expect(updateResult.contextVersion).toBe(2);
    expect(updateResult.contextSession.taskText).toBe(
      'Fix login timeout and token refresh failures'
    );
    expect(updateResult.contextSession.taskIntent).toBe('IMPLEMENTATION');

    const task = await harness.sessionManager.getTask(startResult.task.taskId);
    expect(task?.description).toBe('Fix login timeout and token refresh failures');
    expect(task?.intent).toBe('IMPLEMENTATION');

    // ContextDelta generated with TASK_CHANGED reason
    expect(updateResult.delta).toBeDefined();
    expect(updateResult.delta?.reason).toBe('TASK_CHANGED');
  });
});
