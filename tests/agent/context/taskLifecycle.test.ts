import { describe, it, expect } from 'vitest';
import { createContextHarness } from './ContextTestHelper.js';
import { isValidTaskTransition } from '../../../src/agent/context/models/AgentTask.js';

describe('Agent Task Lifecycle', () => {
  it('creates task and associates it with context session', async () => {
    const harness = createContextHarness();
    const result = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Implement OAuth token refresh mechanism',
      taskTitle: 'OAuth Refresh',
      taskIntent: 'IMPLEMENTATION',
    });

    expect(result.task).toBeDefined();
    expect(result.task.title).toBe('OAuth Refresh');
    expect(result.task.status).toBe('READY');
    expect(result.task.contextSessionId).toBe(result.contextSession.contextSessionId);

    const fetchedTask = await harness.sessionManager.getTask(result.task.taskId);
    expect(fetchedTask).toBeDefined();
    expect(fetchedTask?.taskId).toBe(result.task.taskId);
  });

  it('validates legal and illegal task status transitions', () => {
    // Valid transitions
    expect(isValidTaskTransition('CREATED', 'ANALYZING')).toBe(true);
    expect(isValidTaskTransition('ANALYZING', 'READY')).toBe(true);
    expect(isValidTaskTransition('READY', 'IN_PROGRESS')).toBe(true);
    expect(isValidTaskTransition('IN_PROGRESS', 'VERIFYING')).toBe(true);
    expect(isValidTaskTransition('IN_PROGRESS', 'BLOCKED')).toBe(true);
    expect(isValidTaskTransition('BLOCKED', 'IN_PROGRESS')).toBe(true);
    expect(isValidTaskTransition('VERIFYING', 'COMPLETED')).toBe(true);
    expect(isValidTaskTransition('IN_PROGRESS', 'FAILED')).toBe(true);
    expect(isValidTaskTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);

    // Illegal transitions
    expect(isValidTaskTransition('CREATED', 'COMPLETED')).toBe(false);
    expect(isValidTaskTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    expect(isValidTaskTransition('FAILED', 'READY')).toBe(false);
    expect(isValidTaskTransition('CANCELLED', 'VERIFYING')).toBe(false);
  });

  it('updates task progress when execution reports arrive', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Fix memory leak in websocket connections',
    });

    // Report IN_PROGRESS -> updates task status
    await harness.sessionManager.reportExecution({
      taskId: startResult.task.taskId,
      contextSessionId: startResult.contextSession.contextSessionId,
      status: 'IN_PROGRESS',
      summary: 'Inspected websocket connection pool and heartbeat timers',
      modifiedFiles: ['src/ws/WebSocketPool.ts'],
    });

    const inProgressTask = await harness.sessionManager.getTask(startResult.task.taskId);
    expect(inProgressTask?.status).toBe('IN_PROGRESS');

    // Report COMPLETED -> updates task status to VERIFYING
    await harness.sessionManager.reportExecution({
      taskId: startResult.task.taskId,
      contextSessionId: startResult.contextSession.contextSessionId,
      status: 'COMPLETED',
      summary: 'Added explicit cleanup on connection drop',
      modifiedFiles: ['src/ws/WebSocketPool.ts'],
    });

    const verifyingTask = await harness.sessionManager.getTask(startResult.task.taskId);
    expect(verifyingTask?.status).toBe('VERIFYING');
  });

  it('completes task when context session completes', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Refactor database migration scripts',
    });

    await harness.sessionManager.completeContextSession(startResult.contextSession.contextSessionId);

    const task = await harness.sessionManager.getTask(startResult.task.taskId);
    expect(task?.status).toBe('COMPLETED');
    expect(task?.completedAt).toBeDefined();

    const events = harness.eventBus.published.map((e) => e.event);
    expect(events).toContain('agent.task.completed');
  });

  it('cancels task when context session is cancelled', async () => {
    const harness = createContextHarness();
    const startResult = await harness.sessionManager.startTaskContext({
      agentSessionId: 'session-1',
      workspaceId: 'ws-test-1',
      repositoryId: 'repo-test-1',
      taskText: 'Obsolete migration task',
    });

    await harness.sessionManager.cancelContextSession(
      startResult.contextSession.contextSessionId,
      'User requested cancellation'
    );

    const task = await harness.sessionManager.getTask(startResult.task.taskId);
    expect(task?.status).toBe('CANCELLED');
    expect(task?.metadata?.cancellationReason).toBe('User requested cancellation');

    const events = harness.eventBus.published.map((e) => e.event);
    expect(events).toContain('agent.task.failed');
  });
});
