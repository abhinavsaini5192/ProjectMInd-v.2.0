import type { ResolvedRawSections } from './IFeatureKnowledgeResolver.js';
import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';

export interface IFeatureKnowledgeExplainer {
  generateExplanations(
    featureId: string,
    sections: ResolvedRawSections,
    query: FeatureKnowledgeQuery
  ): Record<string, string>;
}
