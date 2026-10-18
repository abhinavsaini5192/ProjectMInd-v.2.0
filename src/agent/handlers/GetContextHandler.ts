import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { IAgentOperationHandler } from '../interfaces/IAgentOperationHandler.js';
import type { IContextOrchestrator } from '../../context/interfaces/IContextOrchestrator.js';
import type { ContextRequest } from '../../context/models/ContextRequest.js';
import type { ContextResponse } from '../../context/models/ContextResponse.js';

export class GetContextHandler
  implements IAgentOperationHandler<Partial<ContextRequest>, ContextResponse>
{
  public readonly operation: AgentOperationType = 'GET_CONTEXT';
  public readonly requiredCapabilities: readonly AgentCapability[] = ['CONTEXT_REQUEST'];

  constructor(private readonly contextOrchestrator: IContextOrchestrator) {}

  public async handle(
    request: AgentRequest<Partial<ContextRequest>>,
    _session?: AgentSession | undefined
  ): Promise<ContextResponse> {
    const payload = request.payload ?? {};
    const contextRequest: ContextRequest = {
      ...payload,
      workspaceId: payload.workspaceId ?? request.workspaceContext.workspaceId,
      repositoryId: payload.repositoryId ?? request.workspaceContext.repositoryId,
      requestId: payload.requestId ?? request.requestId,
    };

    return this.contextOrchestrator.orchestrateContext(contextRequest);
  }
}
