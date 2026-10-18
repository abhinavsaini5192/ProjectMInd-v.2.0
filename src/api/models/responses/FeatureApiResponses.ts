import type { Feature } from '../../../knowledge/features/models/Feature.js';
import type { FeatureKnowledgeSummary } from '../../../knowledge/features/api/models/FeatureKnowledgeSummary.js';
import type { FeatureKnowledgeResponse } from '../../../knowledge/features/api/models/FeatureKnowledgeResponse.js';
import type { FeatureKnowledgeContextPackage } from '../../../knowledge/features/api/models/FeatureKnowledgeContextPackage.js';
import type { FeatureMappingSection } from '../../../knowledge/features/api/sections/FeatureMappingSection.js';
import type { FeatureDependencySection } from '../../../knowledge/features/api/sections/FeatureDependencySection.js';
import type { FeatureHealthSection } from '../../../knowledge/features/api/sections/FeatureHealthSection.js';
import type { FeatureImpactSection } from '../../../knowledge/features/api/sections/FeatureImpactSection.js';
import type { FeatureHistorySection } from '../../../knowledge/features/api/sections/FeatureHistorySection.js';
import type { FeatureBehaviorSection } from '../../../knowledge/features/api/sections/FeatureBehaviorSection.js';
import type { FeatureArchitectureSection } from '../../../knowledge/features/api/sections/FeatureArchitectureSection.js';

export interface FeatureListResponse {
  readonly response: FeatureKnowledgeResponse;
}

export interface FeatureDetailsResponse {
  readonly feature: Feature | FeatureKnowledgeResponse;
}

export interface FeatureSummaryResponse {
  readonly summary: FeatureKnowledgeSummary;
}

export interface FeatureMappingsResponse {
  readonly mappings: FeatureMappingSection;
}

export interface FeatureDependenciesResponse {
  readonly dependencies: FeatureDependencySection;
}

export interface FeatureHealthResponse {
  readonly health: FeatureHealthSection;
}

export interface FeatureImpactResponse {
  readonly impact: FeatureImpactSection;
}

export interface FeatureHistoryResponse {
  readonly history: FeatureHistorySection;
}

export interface FeatureBehaviorResponse {
  readonly behavior: FeatureBehaviorSection;
}

export interface FeatureArchitectureResponse {
  readonly architecture: FeatureArchitectureSection;
}

export interface FeatureContextResponse {
  readonly context: FeatureKnowledgeContextPackage;
}
