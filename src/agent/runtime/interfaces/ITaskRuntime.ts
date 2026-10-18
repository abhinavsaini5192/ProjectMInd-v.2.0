import type { AgentTask } from '../../context/models/AgentTask.js';
import type { TaskStartResult } from '../models/TaskStartResult.js';
import type { TaskRuntimeSnapshot } from '../models/TaskRuntimeSnapshot.js';
import type { TaskProgress } from '../models/TaskProgress.js';
import type { TaskRuntimeSummary } from '../models/TaskRuntimeSummary.js';
import type { TaskCompletionPolicy } from '../models/TaskCompletionPolicy.js';
import type { TaskFilterOptions } from './ITaskStore.js';
import type { CreateTaskParams, UpdateTaskParams } from './ITaskManager.js';
import type { ScopeValidationParams, TaskExecutionReportParams, TaskExecutionReportResult } from './ITaskExecutionCoordinator.js';
import type { TaskVerificationReportParams, TaskVerificationReportResult } from './ITaskVerificationCoordinator.js';
import type { TaskRecoveryResult, SessionReconnectResult } from './ITaskRecoveryManager.js';

export interface StartTaskParams extends CreateTaskParams {
  readonly featureIds?: readonly string[] | undefined;
  readonly resourceIds?: readonly string[] | undefined;
  readonly changedResources?: readonly string[] | undefined;
  readonly tokenBudget?: number | undefined;
  readonly requestedSections?: readonly string[] | undefined;
  readonly leaseDurationMs?: number | undefined;
}

export interface CompleteTaskParams {
  readonly taskId: string;
  readonly expectedVersion?: number | undefined;
  readonly policy?: TaskCompletionPolicy | undefined;
  readonly reason?: string | undefined;
}

export interface ResumeTaskParams {
  readonly taskId: string;
  readonly expectedVersion?: number | undefined;
  readonly reason?: string | undefined;
}

export interface CancelTaskParams {
  readonly taskId: string;
  readonly reason: string;
  readonly expectedVersion?: number | undefined;
}

export interface ITaskRuntime {
  startTask(params: StartTaskParams, scope: ScopeValidationParams): Promise<TaskStartResult>;
  getTask(taskId: string, scope: ScopeValidationParams): Promise<AgentTask | undefined>;
  listTasks(filter: TaskFilterOptions, scope: ScopeValidationParams): Promise<readonly AgentTask[]>;
  updateTask(params: UpdateTaskParams, scope: ScopeValidationParams): Promise<AgentTask>;
  getTaskRuntimeState(taskId: string, scope: ScopeValidationParams): Promise<TaskRuntimeSnapshot>;
  getTaskProgress(taskId: string, scope: ScopeValidationParams): Promise<TaskProgress>;
  getTaskSummary(taskId: string, scope: ScopeValidationParams): Promise<TaskRuntimeSummary>;
  reportExecution(params: TaskExecutionReportParams, scope: ScopeValidationParams): Promise<TaskExecutionReportResult>;
  reportVerification(params: TaskVerificationReportParams, scope: ScopeValidationParams): Promise<TaskVerificationReportResult>;
  completeTask(params: CompleteTaskParams, scope: ScopeValidationParams): Promise<AgentTask>;
  resumeTask(params: ResumeTaskParams, scope: ScopeValidationParams): Promise<AgentTask>;
  cancelTask(params: CancelTaskParams, scope: ScopeValidationParams): Promise<AgentTask>;
  recoverTask(taskId: string, agentSessionId: string): Promise<TaskRecoveryResult>;
  reconnectSession(agentSessionId: string): Promise<SessionReconnectResult>;
}
