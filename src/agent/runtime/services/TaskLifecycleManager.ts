import type { AgentTask, AgentTaskStatus } from '../../context/models/AgentTask.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import type { ITaskStore } from '../interfaces/ITaskStore.js';
import type {
  ITaskLifecycleManager,
  TransitionTaskParams,
} from '../interfaces/ITaskLifecycleManager.js';
import { TaskTransitionValidator } from './TaskTransitionValidator.js';
import {
  TaskNotFoundError,
  TaskVersionConflictError,
} from '../errors/TaskRuntimeError.js';
import {
  TaskRuntimeEvents,
  type TaskLifecycleEventPayload,
} from '../events/TaskRuntimeEvents.js';

export class TaskLifecycleManager implements ITaskLifecycleManager {
  constructor(
    private readonly store: ITaskStore,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async transition(params: TransitionTaskParams): Promise<AgentTask> {
    const task = await this.store.getTask(params.taskId);
    if (!task) {
      throw new TaskNotFoundError(params.taskId);
    }

    const currentVersion = task.taskVersion ?? 1;
    if (params.expectedVersion !== undefined && params.expectedVersion !== currentVersion) {
      throw new TaskVersionConflictError(params.taskId, params.expectedVersion, currentVersion);
    }

    TaskTransitionValidator.validate(task.status, params.targetState, params.reason);

    const now = new Date();
    const nextVersion = currentVersion + 1;

    const updatedTask: AgentTask = {
      ...task,
      contextSessionId: params.contextSessionId ?? task.contextSessionId,
      status: params.targetState,
      updatedAt: now,
      taskVersion: nextVersion,
      startedAt: params.targetState === 'IN_PROGRESS' && !task.startedAt ? now : task.startedAt,
      completedAt: params.targetState === 'COMPLETED' ? now : task.completedAt,
      blockedReason: params.targetState === 'BLOCKED' ? params.reason : undefined,
      failureReason: params.targetState === 'FAILED' ? params.reason : task.failureReason,
      metadata: {
        ...task.metadata,
        ...(params.metadata ?? {}),
      },
    };

    await this.store.saveTask(updatedTask);

    // Record timeline entry
    await this.store.recordTimeline(params.taskId, {
      event: `Task state changed: ${task.status} -> ${params.targetState}`,
      timestamp: now,
      actor: params.actor,
      details: {
        previousState: task.status,
        newState: params.targetState,
        reason: params.reason,
        version: nextVersion,
      },
    });

    // Emit event
    const eventName = this.mapStatusToEvent(params.targetState);
    if (eventName && this.eventBus) {
      const payload: TaskLifecycleEventPayload = {
        taskId: task.taskId,
        workspaceId: task.workspaceId,
        repositoryId: task.repositoryId,
        agentSessionId: task.agentSessionId,
        previousState: task.status,
        currentState: params.targetState,
        timestamp: now.toISOString(),
        taskVersion: nextVersion,
        reason: params.reason,
        metadata: params.metadata,
      };
      this.eventBus.publish(eventName, payload);
    }

    return updatedTask;
  }

  public async start(taskId: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }
    if (task.status === 'CREATED') {
      await this.transition({ taskId, targetState: 'ANALYZING', actor });
      await this.transition({ taskId, targetState: 'READY', actor });
    } else if (task.status === 'ANALYZING') {
      await this.transition({ taskId, targetState: 'READY', actor });
    }
    return this.transition({ taskId, targetState: 'IN_PROGRESS', actor, expectedVersion });
  }

  public async block(taskId: string, reason: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask> {
    return this.transition({ taskId, targetState: 'BLOCKED', reason, actor, expectedVersion });
  }

  public async resume(taskId: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask> {
    return this.transition({ taskId, targetState: 'IN_PROGRESS', actor, expectedVersion });
  }

  public async verify(taskId: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask> {
    return this.transition({ taskId, targetState: 'VERIFYING', actor, expectedVersion });
  }

  public async complete(taskId: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask> {
    return this.transition({ taskId, targetState: 'COMPLETED', actor, expectedVersion });
  }

  public async fail(taskId: string, reason: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask> {
    return this.transition({ taskId, targetState: 'FAILED', reason, actor, expectedVersion });
  }

  public async cancel(taskId: string, reason: string, actor: string, expectedVersion?: number | undefined): Promise<AgentTask> {
    return this.transition({ taskId, targetState: 'CANCELLED', reason, actor, expectedVersion });
  }

  private mapStatusToEvent(status: AgentTaskStatus): string | undefined {
    switch (status) {
      case 'CREATED':
        return TaskRuntimeEvents.TASK_CREATED;
      case 'ANALYZING':
        return TaskRuntimeEvents.TASK_ANALYZING;
      case 'READY':
        return TaskRuntimeEvents.TASK_READY;
      case 'IN_PROGRESS':
        return TaskRuntimeEvents.TASK_STARTED;
      case 'BLOCKED':
        return TaskRuntimeEvents.TASK_BLOCKED;
      case 'VERIFYING':
        return TaskRuntimeEvents.TASK_VERIFICATION_STARTED;
      case 'COMPLETED':
        return TaskRuntimeEvents.TASK_COMPLETED;
      case 'FAILED':
        return TaskRuntimeEvents.TASK_FAILED;
      case 'CANCELLED':
        return TaskRuntimeEvents.TASK_CANCELLED;
      default:
        return undefined;
    }
  }
}
