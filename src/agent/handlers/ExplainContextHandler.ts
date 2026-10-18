import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { IAgentOperationHandler } from '../interfaces/IAgentOperationHandler.js';
import type { IContextOrchestrator } from '../../context/interfaces/IContextOrchestrator.js';
import type { ContextRequest } from '../../context/models/ContextRequest.js';
import type { ContextExplanation } from '../../context/models/ContextExplanation.js';

export class ExplainContextHandler
  implements IAgentOperationHandler<Partial<ContextRequest>, ContextExplanation>
{
  public readonly operation: AgentOperationType = 'EXPLAIN_CONTEXT';
  public readonly requiredCapabilities: readonly AgentCapability[] = ['CONTEXT_EXPLANATION'];

  constructor(private readonly contextOrchestrator: IContextOrchestrator) {}

  public async handle(
    request: AgentRequest<Partial<ContextRequest>>,
    _session?: AgentSession | undefined
  ): Promise<ContextExplanation> {
    const payload = request.payload ?? {};
    const contextRequest: ContextRequest = {
      ...payload,
      workspaceId: payload.workspaceId ?? request.workspaceContext.workspaceId,
      repositoryId: payload.repositoryId ?? request.workspaceContext.repositoryId,
      requestId: payload.requestId ?? request.requestId,
      explainSelection: true,
    };

    return this.contextOrchestrator.getContextExplanation(contextRequest);
  }
}
