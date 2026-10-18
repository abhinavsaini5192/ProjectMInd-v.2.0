import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { FeatureHistorySection } from '../../knowledge/features/api/sections/FeatureHistorySection.js';
import type { FeatureKnowledgeResponse } from '../../knowledge/features/api/models/FeatureKnowledgeResponse.js';

export class HistoryContextRetriever {
  constructor(private readonly featureKnowledgeApi?: IFeatureKnowledgeAPI | undefined) {}

  public async retrieveHistory(
    featureId: string,
    knowledgeMap: Map<string, FeatureKnowledgeResponse>
  ): Promise<FeatureHistorySection | undefined> {
    const existing = knowledgeMap.get(featureId);
    if (existing?.profile?.history) {
      return existing.profile.history;
    }

    if (this.featureKnowledgeApi) {
      try {
        return await this.featureKnowledgeApi.getFeatureHistory(featureId);
      } catch {
        return undefined;
      }
    }

    return undefined;
  }
}
