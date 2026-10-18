import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { IAgentOperationHandler } from '../interfaces/IAgentOperationHandler.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { FeatureImpactSection } from '../../knowledge/features/api/sections/FeatureImpactSection.js';
import type { FeatureKnowledgeOptions } from '../../knowledge/features/api/models/FeatureKnowledgeOptions.js';
import { AgentValidationError } from '../errors/AgentValidationError.js';

export interface GetImpactPayload {
  readonly featureId: string;
  readonly options?: FeatureKnowledgeOptions | undefined;
}

export class GetImpactHandler
  implements IAgentOperationHandler<GetImpactPayload, FeatureImpactSection>
{
  public readonly operation: AgentOperationType = 'GET_IMPACT';
  public readonly requiredCapabilities: readonly AgentCapability[] = ['IMPACT_QUERY'];

  constructor(private readonly featureKnowledgeApi: IFeatureKnowledgeAPI) {}

  public async handle(
    request: AgentRequest<GetImpactPayload>,
    _session?: AgentSession | undefined
  ): Promise<FeatureImpactSection> {
    const payload = request.payload;
    if (!payload?.featureId || typeof payload.featureId !== 'string' || payload.featureId.trim() === '') {
      throw new AgentValidationError("Operation 'GET_IMPACT' requires a non-empty 'featureId'");
    }

    return this.featureKnowledgeApi.getFeatureImpact(payload.featureId, payload.options);
  }
}
