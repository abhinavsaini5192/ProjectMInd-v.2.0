import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { FeatureArchitectureSection } from '../../knowledge/features/api/sections/FeatureArchitectureSection.js';
import type { FeatureKnowledgeResponse } from '../../knowledge/features/api/models/FeatureKnowledgeResponse.js';

export class ArchitectureContextRetriever {
  constructor(private readonly featureKnowledgeApi?: IFeatureKnowledgeAPI | undefined) {}

  public async retrieveArchitecture(
    featureId: string,
    knowledgeMap: Map<string, FeatureKnowledgeResponse>
  ): Promise<FeatureArchitectureSection | undefined> {
    const existing = knowledgeMap.get(featureId);
    if (existing?.profile?.architecture) {
      return existing.profile.architecture;
    }

    if (this.featureKnowledgeApi) {
      try {
        return await this.featureKnowledgeApi.getFeatureArchitecture(featureId);
      } catch {
        return undefined;
      }
    }

    return undefined;
  }
}
