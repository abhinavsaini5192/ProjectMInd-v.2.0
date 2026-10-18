import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { IAgentOperationHandler } from '../interfaces/IAgentOperationHandler.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { AgentValidationError } from '../errors/AgentValidationError.js';

export interface VerificationReportPayload {
  readonly taskId?: string | undefined;
  readonly passed: boolean;
  readonly testResults?: readonly unknown[] | undefined;
  readonly diagnostics?: readonly unknown[] | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface VerificationReportResult {
  readonly recorded: boolean;
  readonly verificationId: string;
  readonly passed: boolean;
  readonly timestamp: string;
}

export class ReportVerificationHandler
  implements IAgentOperationHandler<VerificationReportPayload, VerificationReportResult>
{
  public readonly operation: AgentOperationType = 'REPORT_VERIFICATION';
  public readonly requiredCapabilities: readonly AgentCapability[] = ['VERIFICATION_REPORT'];

  constructor(private readonly eventBus?: IEventBus | undefined) {}

  public async handle(
    request: AgentRequest<VerificationReportPayload>,
    session?: AgentSession | undefined
  ): Promise<VerificationReportResult> {
    const payload = request.payload;
    if (payload === undefined || typeof payload?.passed !== 'boolean') {
      throw new AgentValidationError("Verification report requires boolean 'passed' field");
    }

    const now = new Date().toISOString();
    const verificationId = `rep_verif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.eventBus?.publish('agent.verification.reported', {
      verificationId,
      agentId: request.agentId,
      sessionId: session?.sessionId ?? request.sessionId,
      payload,
      timestamp: now,
    });

    return {
      recorded: true,
      verificationId,
      passed: payload.passed,
      timestamp: now,
    };
  }
}
