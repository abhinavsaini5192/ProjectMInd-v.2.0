import type { IFeatureKnowledgeAPI } from '../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { FeatureKnowledgeResponse } from '../../knowledge/features/api/models/FeatureKnowledgeResponse.js';

export class ImpactContextRetriever {
  constructor(private readonly featureKnowledgeApi?: IFeatureKnowledgeAPI | undefined) {}

  public async retrieveImpactData(
    featureIds: string[],
    knowledgeMap: Map<string, FeatureKnowledgeResponse>
  ): Promise<Map<string, any[]>> {
    const impactMap = new Map<string, any[]>();

    for (const featureId of featureIds) {
      const existing = knowledgeMap.get(featureId);
      if (existing?.profile?.impact) {
        impactMap.set(featureId, [existing.profile.impact]);
        continue;
      }

      if (this.featureKnowledgeApi) {
        try {
          const impactSec = await this.featureKnowledgeApi.getFeatureImpact(featureId);
          if (impactSec) {
            impactMap.set(featureId, [impactSec]);
          }
        } catch {
          // Graceful fallback
        }
      }
    }

    return impactMap;
  }
}
