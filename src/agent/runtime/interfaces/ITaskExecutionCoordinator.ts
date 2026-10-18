import type { AgentExecutionReportParams } from '../../context/models/AgentExecutionReport.js';
import type { TaskExecutionState } from '../models/TaskExecutionState.js';

export interface ScopeValidationParams {
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly agentSessionId: string;
}

export interface TaskExecutionReportParams extends AgentExecutionReportParams {
  readonly operationId?: string | undefined;
}

export interface TaskExecutionReportResult {
  readonly taskId: string;
  readonly reportId: string;
  readonly acknowledged: boolean;
  readonly executionState: TaskExecutionState;
  readonly invalidationDecision?: string | undefined;
  readonly recordedAt: string;
}

export interface ITaskExecutionCoordinator {
  reportExecution(
    params: TaskExecutionReportParams,
    scope: ScopeValidationParams
  ): Promise<TaskExecutionReportResult>;
  getExecutionState(taskId: string): Promise<TaskExecutionState>;
}
