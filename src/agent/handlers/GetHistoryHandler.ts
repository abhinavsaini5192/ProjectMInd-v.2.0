import type { AgentOperationType } from '../models/AgentOperation.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { IAgentOperationHandler } from '../interfaces/IAgentOperationHandler.js';
import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { FeatureHistorySection } from '../../knowledge/features/api/sections/FeatureHistorySection.js';
import type { FeatureKnowledgeOptions } from '../../knowledge/features/api/models/FeatureKnowledgeOptions.js';
import { AgentValidationError } from '../errors/AgentValidationError.js';

export interface GetHistoryPayload {
  readonly featureId: string;
  readonly options?: FeatureKnowledgeOptions | undefined;
}

export class GetHistoryHandler
  implements IAgentOperationHandler<GetHistoryPayload, FeatureHistorySection>
{
  public readonly operation: AgentOperationType = 'GET_HISTORY';
  public readonly requiredCapabilities: readonly AgentCapability[] = ['HISTORY_QUERY'];

  constructor(private readonly featureKnowledgeApi: IFeatureKnowledgeAPI) {}

  public async handle(
    request: AgentRequest<GetHistoryPayload>,
    _session?: AgentSession | undefined
  ): Promise<FeatureHistorySection> {
    const payload = request.payload;
    if (!payload?.featureId || typeof payload.featureId !== 'string' || payload.featureId.trim() === '') {
      throw new AgentValidationError("Operation 'GET_HISTORY' requires a non-empty 'featureId'");
    }

    return this.featureKnowledgeApi.getFeatureHistory(payload.featureId, payload.options);
  }
}
