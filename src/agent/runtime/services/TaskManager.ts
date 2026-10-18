import type { AgentTask, AgentTaskStatus } from '../../context/models/AgentTask.js';
import type { TaskLease } from '../models/TaskLease.js';
import { isLeaseValid } from '../models/TaskLease.js';
import type { ITaskStore, TaskFilterOptions } from '../interfaces/ITaskStore.js';
import type {
  ITaskManager,
  CreateTaskParams,
  UpdateTaskParams,
} from '../interfaces/ITaskManager.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import {
  TaskNotFoundError,
  TaskVersionConflictError,
  TaskLeaseConflictError,
  TaskScopeError,
} from '../errors/TaskRuntimeError.js';
import { TaskRuntimeEvents } from '../events/TaskRuntimeEvents.js';

export class TaskManager implements ITaskManager {
  constructor(
    private readonly store: ITaskStore,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async createTask(params: CreateTaskParams): Promise<AgentTask> {
    const timestamp = Date.now();
    const taskId =
      params.taskId ?? `task_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;
    const contextSessionId =
      params.contextSessionId ?? `cs_${timestamp}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    const task: AgentTask = {
      taskId,
      contextSessionId,
      agentSessionId: params.agentSessionId,
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      title: params.title,
      description: params.description,
      intent: params.intent ?? 'IMPLEMENTATION',
      status: 'CREATED',
      priority: params.priority ?? 'NORMAL',
      createdAt: now,
      updatedAt: now,
      taskVersion: 1,
      metadata: params.metadata ?? {},
    };

    await this.store.saveTask(task);

    await this.store.recordTimeline(taskId, {
      event: 'Task created',
      timestamp: now,
      actor: params.agentSessionId,
      details: { title: task.title, intent: task.intent },
    });

    if (this.eventBus) {
      this.eventBus.publish(TaskRuntimeEvents.TASK_CREATED, {
        taskId: task.taskId,
        workspaceId: task.workspaceId,
        repositoryId: task.repositoryId,
        agentSessionId: task.agentSessionId,
        previousState: 'CREATED',
        currentState: 'CREATED',
        timestamp: now.toISOString(),
        taskVersion: 1,
      });
    }

    return task;
  }

  public async getTask(taskId: string): Promise<AgentTask | undefined> {
    return this.store.getTask(taskId);
  }

  public async listTasks(filter?: TaskFilterOptions | undefined): Promise<readonly AgentTask[]> {
    return this.store.listTasks(filter);
  }

  public async updateTask(params: UpdateTaskParams): Promise<AgentTask> {
    const task = await this.store.getTask(params.taskId);
    if (!task) {
      throw new TaskNotFoundError(params.taskId);
    }

    const currentVersion = task.taskVersion ?? 1;
    if (params.expectedVersion !== undefined && params.expectedVersion !== currentVersion) {
      throw new TaskVersionConflictError(params.taskId, params.expectedVersion, currentVersion);
    }

    const nextVersion = currentVersion + 1;
    const now = new Date();

    const updated: AgentTask = {
      ...task,
      contextSessionId: params.contextSessionId ?? task.contextSessionId,
      title: params.title ?? task.title,
      description: params.description ?? task.description,
      intent: params.intent ?? task.intent,
      priority: params.priority ?? task.priority,
      updatedAt: now,
      taskVersion: nextVersion,
      metadata: {
        ...task.metadata,
        ...(params.metadata ?? {}),
      },
    };

    await this.store.saveTask(updated);

    await this.store.recordTimeline(params.taskId, {
      event: 'Task updated',
      timestamp: now,
      details: {
        title: updated.title,
        version: nextVersion,
      },
    });

    return updated;
  }

  public async setTaskStatus(
    taskId: string,
    status: AgentTaskStatus,
    reason?: string | undefined,
    expectedVersion?: number | undefined
  ): Promise<AgentTask> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const currentVersion = task.taskVersion ?? 1;
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      throw new TaskVersionConflictError(taskId, expectedVersion, currentVersion);
    }

    const nextVersion = currentVersion + 1;
    const now = new Date();

    const updated: AgentTask = {
      ...task,
      status,
      updatedAt: now,
      taskVersion: nextVersion,
      startedAt: status === 'IN_PROGRESS' && !task.startedAt ? now : task.startedAt,
      completedAt: status === 'COMPLETED' ? now : task.completedAt,
      blockedReason: status === 'BLOCKED' ? reason : undefined,
      failureReason: status === 'FAILED' ? reason : task.failureReason,
    };

    await this.store.saveTask(updated);
    return updated;
  }

  public async acquireLease(
    taskId: string,
    agentSessionId: string,
    durationMs: number = 300000 // 5 minutes default
  ): Promise<TaskLease> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const existingLease = await this.store.getLease(taskId);
    const now = new Date();

    if (existingLease && isLeaseValid(existingLease, now)) {
      if (existingLease.leaseOwner !== agentSessionId) {
        throw new TaskLeaseConflictError(taskId, existingLease.leaseOwner, agentSessionId);
      }
      // Re-acquiring own valid lease = renew
      return this.renewLease(taskId, agentSessionId, durationMs);
    }

    const expiresAt = new Date(now.getTime() + durationMs);
    const lease: TaskLease = {
      taskId,
      leaseOwner: agentSessionId,
      acquiredAt: now,
      expiresAt,
    };

    await this.store.saveLease(lease);

    // Also update task lease fields
    const updatedTask: AgentTask = {
      ...task,
      leaseOwner: agentSessionId,
      leaseExpiresAt: expiresAt,
      updatedAt: now,
    };
    await this.store.saveTask(updatedTask);

    if (this.eventBus) {
      this.eventBus.publish(TaskRuntimeEvents.TASK_LEASE_ACQUIRED, {
        taskId,
        agentSessionId,
        leaseExpiresAt: expiresAt.toISOString(),
        timestamp: now.toISOString(),
      });
    }

    return lease;
  }

  public async renewLease(
    taskId: string,
    agentSessionId: string,
    durationMs: number = 300000
  ): Promise<TaskLease> {
    const existingLease = await this.store.getLease(taskId);
    if (!existingLease) {
      return this.acquireLease(taskId, agentSessionId, durationMs);
    }

    if (existingLease.leaseOwner !== agentSessionId) {
      throw new TaskLeaseConflictError(taskId, existingLease.leaseOwner, agentSessionId);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMs);

    const renewed: TaskLease = {
      ...existingLease,
      expiresAt,
      renewedAt: now,
    };

    await this.store.saveLease(renewed);

    const task = await this.store.getTask(taskId);
    if (task) {
      await this.store.saveTask({
        ...task,
        leaseOwner: agentSessionId,
        leaseExpiresAt: expiresAt,
        updatedAt: now,
      });
    }

    return renewed;
  }

  public async releaseLease(taskId: string, agentSessionId: string): Promise<boolean> {
    const existingLease = await this.store.getLease(taskId);
    if (!existingLease) {
      return false;
    }

    if (existingLease.leaseOwner !== agentSessionId) {
      throw new TaskLeaseConflictError(taskId, existingLease.leaseOwner, agentSessionId);
    }

    await this.store.deleteLease(taskId);

    const task = await this.store.getTask(taskId);
    if (task) {
      await this.store.saveTask({
        ...task,
        leaseOwner: undefined,
        leaseExpiresAt: undefined,
        updatedAt: new Date(),
      });
    }

    if (this.eventBus) {
      this.eventBus.publish(TaskRuntimeEvents.TASK_LEASE_RELEASED, {
        taskId,
        agentSessionId,
        timestamp: new Date().toISOString(),
      });
    }

    return true;
  }

  public async getLease(taskId: string): Promise<TaskLease | undefined> {
    return this.store.getLease(taskId);
  }

  public assertLeaseOrOwnership(task: AgentTask, agentSessionId: string): void {
    if (task.agentSessionId !== agentSessionId) {
      throw new TaskScopeError(
        `Task '${task.taskId}' belongs to agent session '${task.agentSessionId}', not '${agentSessionId}'`,
        { taskId: task.taskId, taskSessionId: task.agentSessionId, requestingSessionId: agentSessionId }
      );
    }

    if (task.leaseOwner && task.leaseExpiresAt) {
      const now = new Date();
      if (task.leaseExpiresAt.getTime() > now.getTime() && task.leaseOwner !== agentSessionId) {
        throw new TaskLeaseConflictError(task.taskId, task.leaseOwner, agentSessionId);
      }
    }
  }
}
