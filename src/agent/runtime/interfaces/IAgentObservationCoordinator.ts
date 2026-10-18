import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { ToolResponse } from '../../protocol/models/ToolResponse.js';
import type { TaskExecutionReportParams, TaskExecutionReportResult, ScopeValidationParams } from './ITaskExecutionCoordinator.js';

export interface IAgentObservationCoordinator {
  recordToolObservation(
    request: ToolRequest,
    response: ToolResponse,
    durationMs: number
  ): Promise<void>;

  recordExecutionReport(
    params: TaskExecutionReportParams,
    scope: ScopeValidationParams
  ): Promise<TaskExecutionReportResult>;
}
