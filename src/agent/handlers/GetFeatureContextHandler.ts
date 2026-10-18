import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { IAgentOperationHandler } from '../interfaces/IAgentOperationHandler.js';
import type { IContextOrchestrator } from '../../context/interfaces/IContextOrchestrator.js';
import type { ContextRequest } from '../../context/models/ContextRequest.js';
import type { ContextResponse } from '../../context/models/ContextResponse.js';

export interface GetFeatureContextPayload extends Partial<ContextRequest> {
  readonly featureId?: string | undefined;
}

export class GetFeatureContextHandler
  implements IAgentOperationHandler<GetFeatureContextPayload, ContextResponse>
{
  public readonly operation: AgentOperationType = 'GET_FEATURE_CONTEXT';
  public readonly requiredCapabilities: readonly AgentCapability[] = ['TASK_CONTEXT'];

  constructor(private readonly contextOrchestrator: IContextOrchestrator) {}

  public async handle(
    request: AgentRequest<GetFeatureContextPayload>,
    _session?: AgentSession | undefined
  ): Promise<ContextResponse> {
    const payload = request.payload ?? {};
    let featureIds = payload.featureIds;
    if (!featureIds && payload.featureId) {
      featureIds = [payload.featureId];
    }

    const contextRequest: ContextRequest = {
      ...payload,
      featureIds,
      workspaceId: payload.workspaceId ?? request.workspaceContext.workspaceId,
      repositoryId: payload.repositoryId ?? request.workspaceContext.repositoryId,
      requestId: payload.requestId ?? request.requestId,
    };

    return this.contextOrchestrator.getFeatureContextForTask(contextRequest);
  }
}
