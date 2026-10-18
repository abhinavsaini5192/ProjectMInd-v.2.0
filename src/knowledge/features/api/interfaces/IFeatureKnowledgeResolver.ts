import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import type { FeatureKnowledgeExecutionPlan } from './IFeatureKnowledgePlanner.js';
import type { FeatureIdentitySection } from '../sections/FeatureIdentitySection.js';
import type { FeatureMappingSection } from '../sections/FeatureMappingSection.js';
import type { FeatureDependencySection } from '../sections/FeatureDependencySection.js';
import type { FeatureBehaviorSection } from '../sections/FeatureBehaviorSection.js';
import type { FeatureHealthSection } from '../sections/FeatureHealthSection.js';
import type { FeatureImpactSection } from '../sections/FeatureImpactSection.js';
import type { FeatureHistorySection } from '../sections/FeatureHistorySection.js';
import type { FeatureArchitectureSection } from '../sections/FeatureArchitectureSection.js';

export interface ResolvedRawSections {
  identity: FeatureIdentitySection;
  mappings: FeatureMappingSection;
  dependencies: FeatureDependencySection;
  behavior: FeatureBehaviorSection;
  health: FeatureHealthSection;
  impact: FeatureImpactSection;
  history: FeatureHistorySection;
  architecture: FeatureArchitectureSection;
}

export interface IFeatureKnowledgeResolver {
  resolveSections(
    plan: FeatureKnowledgeExecutionPlan,
    query: FeatureKnowledgeQuery
  ): Promise<ResolvedRawSections>;
}
