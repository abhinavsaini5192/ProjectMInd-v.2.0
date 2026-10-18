import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { ToolResponse } from '../../protocol/models/ToolResponse.js';
import type {
  ITaskExecutionCoordinator,
  TaskExecutionReportParams,
  TaskExecutionReportResult,
  ScopeValidationParams,
} from '../interfaces/ITaskExecutionCoordinator.js';
import type { IAgentObservationCoordinator } from '../interfaces/IAgentObservationCoordinator.js';
import type { IObservationProcessor } from '../../observation/interfaces/IObservationProcessor.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';

export class AgentObservationCoordinator implements IAgentObservationCoordinator {
  constructor(
    private readonly executionCoordinator: ITaskExecutionCoordinator,
    private readonly observationProcessor?: IObservationProcessor | undefined,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async recordToolObservation(
    request: ToolRequest,
    response: ToolResponse,
    durationMs: number
  ): Promise<void> {
    if (this.observationProcessor) {
      try {
        await this.observationProcessor.processRawObservation(
          {
            source: 'SYSTEM',
            type: 'TOOL_EXECUTION',
            timestamp: new Date().toISOString(),
            payload: {
              requestId: request.requestId,
              toolName: request.toolName,
              durationMs,
              status: response.success ? 'SUCCESS' : 'FAILED',
              success: response.success,
            },
            workspaceId: request.workspaceId,
            repositoryId: request.repositoryId,
            agentSessionId: request.sessionId,
          },
          {
            workspaceId: request.workspaceId,
            repositoryId: request.repositoryId,
            agentSessionId: request.sessionId,
          }
        );
      } catch {
        // Non-blocking observation recording
      }
    }
  }

  public async recordExecutionReport(
    params: TaskExecutionReportParams,
    scope: ScopeValidationParams
  ): Promise<TaskExecutionReportResult> {
    // Treat all claims in execution reports as AGENT_REPORTED
    const safeParams: TaskExecutionReportParams = {
      ...params,
      metadata: {
        ...params.metadata,
        evidenceLevel: 'AGENT_REPORTED',
      },
    };

    return this.executionCoordinator.reportExecution(safeParams, scope);
  }
}
