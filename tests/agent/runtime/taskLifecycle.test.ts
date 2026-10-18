import { describe, it, expect } from 'vitest';
import { createTestTaskRuntime, MockEventBus } from './RuntimeTestHelper.js';
import { TaskRuntimeEvents } from '../../../src/agent/runtime/events/TaskRuntimeEvents.js';

describe('Task Lifecycle Management', () => {
  it('creates task with CREATED state, version 1, and emits TASK_CREATED', async () => {
    const eventBus = new MockEventBus();
    const { taskManager } = createTestTaskRuntime({ eventBus });

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Fix login bug',
      description: 'Resolve token refresh timeout in auth service',
      intent: 'DEBUGGING',
      priority: 'HIGH',
    });

    expect(task.taskId).toBeDefined();
    expect(task.status).toBe('CREATED');
    expect(task.taskVersion).toBe(1);
    expect(task.priority).toBe('HIGH');
    expect(task.createdAt).toBeInstanceOf(Date);

    const createdEvent = eventBus.publishedEvents.find(
      (e) => e.event === TaskRuntimeEvents.TASK_CREATED
    );
    expect(createdEvent).toBeDefined();
    expect((createdEvent?.payload as any).taskId).toBe(task.taskId);
  });

  it('progresses through canonical state machine transitions to COMPLETED', async () => {
    const eventBus = new MockEventBus();
    const { taskManager, lifecycleManager } = createTestTaskRuntime({ eventBus });

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Implement OAuth',
      description: 'Add Google OAuth support',
    });

    // CREATED -> ANALYZING
    const analyzing = await lifecycleManager.transition({
      taskId: task.taskId,
      targetState: 'ANALYZING',
      actor: 'agent-1',
    });
    expect(analyzing.status).toBe('ANALYZING');
    expect(analyzing.taskVersion).toBe(2);

    // ANALYZING -> READY
    const ready = await lifecycleManager.transition({
      taskId: task.taskId,
      targetState: 'READY',
      actor: 'agent-1',
    });
    expect(ready.status).toBe('READY');
    expect(ready.taskVersion).toBe(3);

    // READY -> IN_PROGRESS
    const running = await lifecycleManager.start(task.taskId, 'agent-1');
    expect(running.status).toBe('IN_PROGRESS');
    expect(running.startedAt).toBeInstanceOf(Date);
    expect(running.taskVersion).toBe(4);

    // IN_PROGRESS -> VERIFYING
    const verifying = await lifecycleManager.verify(task.taskId, 'agent-1');
    expect(verifying.status).toBe('VERIFYING');
    expect(verifying.taskVersion).toBe(5);

    // VERIFYING -> COMPLETED
    const completed = await lifecycleManager.complete(task.taskId, 'agent-1');
    expect(completed.status).toBe('COMPLETED');
    expect(completed.completedAt).toBeInstanceOf(Date);
    expect(completed.taskVersion).toBe(6);

    const completedEvent = eventBus.publishedEvents.find(
      (e) => e.event === TaskRuntimeEvents.TASK_COMPLETED
    );
    expect(completedEvent).toBeDefined();
    expect((completedEvent?.payload as any).currentState).toBe('COMPLETED');
  });

  it('handles BLOCKED and RESUMED states cleanly', async () => {
    const { taskManager, lifecycleManager } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Database Migration',
      description: 'Run Prisma migration on production replica',
    });

    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'ANALYZING' });
    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'READY' });
    await lifecycleManager.start(task.taskId, 'agent-1');

    // IN_PROGRESS -> BLOCKED
    const blocked = await lifecycleManager.block(
      task.taskId,
      'Waiting for DBA approval',
      'agent-1'
    );
    expect(blocked.status).toBe('BLOCKED');
    expect(blocked.blockedReason).toBe('Waiting for DBA approval');

    // BLOCKED -> IN_PROGRESS (Resumed)
    const resumed = await lifecycleManager.resume(task.taskId, 'agent-1');
    expect(resumed.status).toBe('IN_PROGRESS');
    expect(resumed.blockedReason).toBeUndefined();
  });

  it('handles FAILED state with failure reason', async () => {
    const { taskManager, lifecycleManager } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Deploy microservice',
      description: 'Deploy cart service to cluster',
    });

    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'ANALYZING' });
    await lifecycleManager.transition({ taskId: task.taskId, targetState: 'READY' });
    await lifecycleManager.start(task.taskId, 'agent-1');

    const failed = await lifecycleManager.fail(
      task.taskId,
      'Insufficient quota in cluster',
      'agent-1'
    );
    expect(failed.status).toBe('FAILED');
    expect(failed.failureReason).toBe('Insufficient quota in cluster');
  });

  it('cancels active task with mandatory reason', async () => {
    const { taskManager, lifecycleManager } = createTestTaskRuntime();

    const task = await taskManager.createTask({
      agentSessionId: 'session-1',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      title: 'Obsolete feature',
      description: 'Implement legacy protocol adapter',
    });

    const cancelled = await lifecycleManager.cancel(
      task.taskId,
      'Requirements superseded by RFC-402',
      'agent-1'
    );
    expect(cancelled.status).toBe('CANCELLED');
  });
});
