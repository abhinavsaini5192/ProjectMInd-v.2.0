import { describe, it, expect } from 'vitest';
import { createObservationTestHarness } from './ObservationTestHelper.js';

describe('Task and Context Integration', () => {
  it('updates TaskRuntime execution state when processing execution reports', async () => {
    const { processor, taskRuntime } = createObservationTestHarness();

    const report = {
      taskId: 'task-integrate-1',
      status: 'SUCCESS',
      summary: 'Modified AuthService and AuthController',
      modifiedFiles: ['src/auth/AuthService.ts', 'src/auth/AuthController.ts'],
      operationId: 'op-edit-1',
    };

    const res = await processor.processExecutionReport(report, 'session-1');
    expect(res.observation!.observationId).toBeDefined();

    expect(taskRuntime.updatedExecutions.length).toBe(1);
    expect(taskRuntime.updatedExecutions[0]?.taskId).toBe('task-integrate-1');
    expect(taskRuntime.updatedExecutions[0]?.payload.modifiedFiles).toEqual([
      'src/auth/AuthService.ts',
      'src/auth/AuthController.ts',
    ]);
  });

  it('transitions TaskRuntime task state to BLOCKED on blocker observation', async () => {
    const { processor, taskRuntime } = createObservationTestHarness();

    await processor.process({
      taskId: 'task-blocker-1',
      sessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      source: 'AGENT',
      type: 'BLOCKER_ENCOUNTERED',
      summary: 'Missing Redis dependency in docker compose',
      payload: {
        blockerType: 'DEPENDENCY_MISSING',
        description: 'Redis is required for session cache',
      },
    });

    expect(taskRuntime.updatedStatuses.length).toBe(1);
    expect(taskRuntime.updatedStatuses[0]?.taskId).toBe('task-blocker-1');
    expect(taskRuntime.updatedStatuses[0]?.status).toBe('BLOCKED');
  });

  it('triggers context session invalidation when affected files match active context resources', async () => {
    const { processor, contextSessionManager } = createObservationTestHarness();

    // Active context package in mock has 'src/auth/AuthService.ts'
    await processor.processExecutionReport(
      {
        taskId: 'task-ctx-1',
        contextSessionId: 'session-ctx-100',
        status: 'SUCCESS',
        summary: 'Updated auth token handling',
        modifiedFiles: ['src/auth/AuthService.ts'],
      },
      'agent-session-1'
    );

    expect(contextSessionManager.invalidatedSessions.length).toBe(1);
    expect(contextSessionManager.invalidatedSessions[0]?.sessionId).toBe('session-ctx-100');
    expect(contextSessionManager.invalidatedSessions[0]?.changedFiles).toContain('src/auth/AuthService.ts');
  });
});
