import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { IAgentOperationHandler } from '../interfaces/IAgentOperationHandler.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { FeatureKnowledgeResponse } from '../../knowledge/features/api/models/FeatureKnowledgeResponse.js';
import type { FeatureKnowledgeOptions } from '../../knowledge/features/api/models/FeatureKnowledgeOptions.js';
import { AgentValidationError } from '../errors/AgentValidationError.js';

export interface GetFeaturePayload {
  readonly featureId: string;
  readonly options?: FeatureKnowledgeOptions | undefined;
}

export class GetFeatureHandler
  implements IAgentOperationHandler<GetFeaturePayload, FeatureKnowledgeResponse>
{
  public readonly operation: AgentOperationType = 'GET_FEATURE';
  public readonly requiredCapabilities: readonly AgentCapability[] = ['FEATURE_QUERY'];

  constructor(private readonly featureKnowledgeApi: IFeatureKnowledgeAPI) {}

  public async handle(
    request: AgentRequest<GetFeaturePayload>,
    _session?: AgentSession | undefined
  ): Promise<FeatureKnowledgeResponse> {
    const payload = request.payload;
    if (!payload?.featureId || typeof payload.featureId !== 'string' || payload.featureId.trim() === '') {
      throw new AgentValidationError("Operation 'GET_FEATURE' requires a non-empty 'featureId'");
    }

    return this.featureKnowledgeApi.getFeatureProfile(payload.featureId, payload.options);
  }
}
