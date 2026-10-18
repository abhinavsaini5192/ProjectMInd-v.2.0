import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { IAgentOperationHandler } from '../interfaces/IAgentOperationHandler.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { AgentValidationError } from '../errors/AgentValidationError.js';

export interface ExecutionReportPayload {
  readonly taskId?: string | undefined;
  readonly operationId?: string | undefined;
  readonly status: string;
  readonly changedFiles?: readonly string[] | undefined;
  readonly summary?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface ExecutionReportResult {
  readonly recorded: boolean;
  readonly reportId: string;
  readonly timestamp: string;
  readonly status: string;
}

export class ReportExecutionHandler
  implements IAgentOperationHandler<ExecutionReportPayload, ExecutionReportResult>
{
  public readonly operation: AgentOperationType = 'REPORT_EXECUTION';
  public readonly requiredCapabilities: readonly AgentCapability[] = ['EXECUTION_REPORT'];

  constructor(private readonly eventBus?: IEventBus | undefined) {}

  public async handle(
    request: AgentRequest<ExecutionReportPayload>,
    session?: AgentSession | undefined
  ): Promise<ExecutionReportResult> {
    const payload = request.payload;
    if (!payload?.status || typeof payload.status !== 'string') {
      throw new AgentValidationError("Execution report requires a non-empty 'status'");
    }

    const now = new Date().toISOString();
    const reportId = `rep_exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.eventBus?.publish('agent.execution.reported', {
      reportId,
      agentId: request.agentId,
      sessionId: session?.sessionId ?? request.sessionId,
      payload,
      timestamp: now,
    });

    return {
      recorded: true,
      reportId,
      timestamp: now,
      status: payload.status,
    };
  }
}
