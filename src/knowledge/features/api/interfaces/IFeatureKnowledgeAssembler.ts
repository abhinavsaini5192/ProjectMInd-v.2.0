import type { FeatureKnowledgeProfile } from '../models/FeatureKnowledgeProfile.js';
import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import type { FeatureKnowledgeExecutionPlan } from './IFeatureKnowledgePlanner.js';
import type { ResolvedRawSections } from './IFeatureKnowledgeResolver.js';
import type { FreshnessEvaluation } from './IFeatureKnowledgeFreshnessResolver.js';

export interface IFeatureKnowledgeAssembler {
  assembleProfile(
    featureId: string,
    sections: ResolvedRawSections,
    plan: FeatureKnowledgeExecutionPlan,
    query: FeatureKnowledgeQuery,
    freshnessEval: FreshnessEvaluation,
    explanations: Record<string, string>
  ): FeatureKnowledgeProfile;
}
