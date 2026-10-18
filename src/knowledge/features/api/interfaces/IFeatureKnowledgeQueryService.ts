import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import type { FeatureKnowledgeResponse } from '../models/FeatureKnowledgeResponse.js';

export interface IFeatureKnowledgeQueryService {
  query(query: FeatureKnowledgeQuery): Promise<FeatureKnowledgeResponse>;
}
