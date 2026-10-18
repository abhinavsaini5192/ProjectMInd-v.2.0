import type { AgentTask } from '../../context/models/AgentTask.js';
import type { TaskStartResult } from '../models/TaskStartResult.js';
import type { StartTaskParams, CompleteTaskParams, CancelTaskParams } from './ITaskRuntime.js';
import type { ScopeValidationParams } from './ITaskExecutionCoordinator.js';

export interface IAgentTaskCoordinator {
  submitTask(params: StartTaskParams, scope: ScopeValidationParams): Promise<TaskStartResult>;
  getTask(taskId: string, scope: ScopeValidationParams): Promise<AgentTask | undefined>;
  cancelTask(params: CancelTaskParams, scope: ScopeValidationParams): Promise<AgentTask>;
  completeTask(params: CompleteTaskParams, scope: ScopeValidationParams): Promise<AgentTask>;
  getActiveTaskCount(): number;
}
