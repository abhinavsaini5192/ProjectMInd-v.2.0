import type { AgentTask, AgentTaskStatus } from '../../context/models/AgentTask.js';
import type { TaskFilterOptions } from './ITaskStore.js';
import type { TaskLease } from '../models/TaskLease.js';

export interface CreateTaskParams {
  readonly taskId?: string | undefined;
  readonly contextSessionId?: string | undefined;
  readonly agentSessionId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly title: string;
  readonly description: string;
  readonly intent?: string | undefined;
  readonly priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface UpdateTaskParams {
  readonly taskId: string;
  readonly expectedVersion?: number | undefined;
  readonly contextSessionId?: string | undefined;
  readonly title?: string | undefined;
  readonly description?: string | undefined;
  readonly intent?: string | undefined;
  readonly priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface ITaskManager {
  createTask(params: CreateTaskParams): Promise<AgentTask>;
  getTask(taskId: string): Promise<AgentTask | undefined>;
  listTasks(filter?: TaskFilterOptions | undefined): Promise<readonly AgentTask[]>;
  updateTask(params: UpdateTaskParams): Promise<AgentTask>;
  setTaskStatus(
    taskId: string,
    status: AgentTaskStatus,
    reason?: string | undefined,
    expectedVersion?: number | undefined
  ): Promise<AgentTask>;
  acquireLease(taskId: string, agentSessionId: string, durationMs?: number | undefined): Promise<TaskLease>;
  renewLease(taskId: string, agentSessionId: string, durationMs?: number | undefined): Promise<TaskLease>;
  releaseLease(taskId: string, agentSessionId: string): Promise<boolean>;
  getLease(taskId: string): Promise<TaskLease | undefined>;
  assertLeaseOrOwnership(task: AgentTask, agentSessionId: string): void;
}
