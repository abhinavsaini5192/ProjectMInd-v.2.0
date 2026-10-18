import type { FeatureKnowledgeFreshness } from '../models/FeatureKnowledgeFreshness.js';
import type { FeatureKnowledgeVersion } from '../models/FeatureKnowledgeVersion.js';
import type { ResolvedRawSections } from './IFeatureKnowledgeResolver.js';
import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';

export interface FreshnessEvaluation {
  freshness: FeatureKnowledgeFreshness;
  versionStatus: FeatureKnowledgeVersion;
}

export interface IFeatureKnowledgeFreshnessResolver {
  evaluateFreshness(
    sections: ResolvedRawSections,
    query: FeatureKnowledgeQuery
  ): FreshnessEvaluation;
}
