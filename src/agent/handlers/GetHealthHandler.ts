import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { IAgentOperationHandler } from '../interfaces/IAgentOperationHandler.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { FeatureHealthSection } from '../../knowledge/features/api/sections/FeatureHealthSection.js';
import type { FeatureKnowledgeOptions } from '../../knowledge/features/api/models/FeatureKnowledgeOptions.js';
import { AgentValidationError } from '../errors/AgentValidationError.js';

export interface GetHealthPayload {
  readonly featureId: string;
  readonly options?: FeatureKnowledgeOptions | undefined;
}

export class GetHealthHandler
  implements IAgentOperationHandler<GetHealthPayload, FeatureHealthSection>
{
  public readonly operation: AgentOperationType = 'GET_HEALTH';
  public readonly requiredCapabilities: readonly AgentCapability[] = ['HEALTH_QUERY'];

  constructor(private readonly featureKnowledgeApi: IFeatureKnowledgeAPI) {}

  public async handle(
    request: AgentRequest<GetHealthPayload>,
    _session?: AgentSession | undefined
  ): Promise<FeatureHealthSection> {
    const payload = request.payload;
    if (!payload?.featureId || typeof payload.featureId !== 'string' || payload.featureId.trim() === '') {
      throw new AgentValidationError("Operation 'GET_HEALTH' requires a non-empty 'featureId'");
    }

    return this.featureKnowledgeApi.getFeatureHealth(payload.featureId, payload.options);
  }
}
