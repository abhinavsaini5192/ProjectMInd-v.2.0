import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { IAgentOperationHandler } from '../interfaces/IAgentOperationHandler.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { FeatureArchitectureSection } from '../../knowledge/features/api/sections/FeatureArchitectureSection.js';
import type { FeatureKnowledgeOptions } from '../../knowledge/features/api/models/FeatureKnowledgeOptions.js';
import { AgentValidationError } from '../errors/AgentValidationError.js';

export interface GetArchitecturePayload {
  readonly featureId: string;
  readonly options?: FeatureKnowledgeOptions | undefined;
}

export class GetArchitectureHandler
  implements IAgentOperationHandler<GetArchitecturePayload, FeatureArchitectureSection>
{
  public readonly operation: AgentOperationType = 'GET_ARCHITECTURE';
  public readonly requiredCapabilities: readonly AgentCapability[] = ['ARCHITECTURE_QUERY'];

  constructor(private readonly featureKnowledgeApi: IFeatureKnowledgeAPI) {}

  public async handle(
    request: AgentRequest<GetArchitecturePayload>,
    _session?: AgentSession | undefined
  ): Promise<FeatureArchitectureSection> {
    const payload = request.payload;
    if (!payload?.featureId || typeof payload.featureId !== 'string' || payload.featureId.trim() === '') {
      throw new AgentValidationError("Operation 'GET_ARCHITECTURE' requires a non-empty 'featureId'");
    }

    return this.featureKnowledgeApi.getFeatureArchitecture(payload.featureId, payload.options);
  }
}
