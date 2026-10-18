import type { AgentTask, AgentTaskStatus } from '../../context/models/AgentTask.js';
import type { TaskExecutionState } from '../models/TaskExecutionState.js';
import type { TaskVerificationState } from '../models/TaskVerificationState.js';
import type { TaskLease } from '../models/TaskLease.js';
import type { TaskTimelineEntry } from '../models/TaskRuntimeSummary.js';

export interface TaskFilterOptions {
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly status?: AgentTaskStatus | undefined;
}

export interface ITaskStore {
  saveTask(task: AgentTask): Promise<void>;
  getTask(taskId: string): Promise<AgentTask | undefined>;
  listTasks(filter?: TaskFilterOptions | undefined): Promise<readonly AgentTask[]>;
  deleteTask(taskId: string): Promise<boolean>;

  saveExecutionState(taskId: string, state: TaskExecutionState): Promise<void>;
  getExecutionState(taskId: string): Promise<TaskExecutionState | undefined>;

  saveVerificationState(taskId: string, state: TaskVerificationState): Promise<void>;
  getVerificationState(taskId: string): Promise<TaskVerificationState | undefined>;

  saveLease(lease: TaskLease): Promise<void>;
  getLease(taskId: string): Promise<TaskLease | undefined>;
  deleteLease(taskId: string): Promise<boolean>;

  recordTimeline(taskId: string, entry: TaskTimelineEntry): Promise<void>;
  getTimeline(taskId: string): Promise<readonly TaskTimelineEntry[]>;

  recordProcessedOperation(operationId: string, reportId: string): Promise<void>;
  getProcessedOperationReportId(operationId: string): Promise<string | undefined>;

  clear(): Promise<void>;
}
