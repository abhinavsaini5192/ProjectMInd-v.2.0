import type { IFeatureKnowledgeQueryService } from '../interfaces/IFeatureKnowledgeQueryService.js';
import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import type { FeatureKnowledgeResponse } from '../models/FeatureKnowledgeResponse.js';
import type { FeatureKnowledgeProfile } from '../models/FeatureKnowledgeProfile.js';

export class FeatureKnowledgeReadRepository {
  constructor(private readonly queryService: IFeatureKnowledgeQueryService) {}

  public async getProfile(
    featureId: string,
    options?: Partial<FeatureKnowledgeQuery> | undefined
  ): Promise<FeatureKnowledgeProfile> {
    const res = await this.queryService.query({
      featureId,
      ...options,
    });
    return res.profile;
  }

  public async query(query: FeatureKnowledgeQuery): Promise<FeatureKnowledgeResponse> {
    return this.queryService.query(query);
  }
}
