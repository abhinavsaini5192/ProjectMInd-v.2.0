import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { IAgentOperationHandler } from '../interfaces/IAgentOperationHandler.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { AgentValidationError } from '../errors/AgentValidationError.js';

export interface UpdateKnowledgePayload {
  readonly knowledgeType: string;
  readonly payload: unknown;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface UpdateKnowledgeResult {
  readonly recorded: boolean;
  readonly updateId: string;
  readonly knowledgeType: string;
  readonly timestamp: string;
}

export class UpdateKnowledgeHandler
  implements IAgentOperationHandler<UpdateKnowledgePayload, UpdateKnowledgeResult>
{
  public readonly operation: AgentOperationType = 'UPDATE_KNOWLEDGE';
  public readonly requiredCapabilities: readonly AgentCapability[] = ['KNOWLEDGE_UPDATE'];

  constructor(private readonly eventBus?: IEventBus | undefined) {}

  public async handle(
    request: AgentRequest<UpdateKnowledgePayload>,
    session?: AgentSession | undefined
  ): Promise<UpdateKnowledgeResult> {
    const payload = request.payload;
    if (!payload?.knowledgeType || typeof payload.knowledgeType !== 'string') {
      throw new AgentValidationError("Knowledge update requires a non-empty 'knowledgeType'");
    }

    const now = new Date().toISOString();
    const updateId = `know_upd_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    this.eventBus?.publish('agent.knowledge.updated', {
      updateId,
      agentId: request.agentId,
      sessionId: session?.sessionId ?? request.sessionId,
      payload,
      timestamp: now,
    });

    return {
      recorded: true,
      updateId,
      knowledgeType: payload.knowledgeType,
      timestamp: now,
    };
  }
}
