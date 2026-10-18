import type { FeatureIdentitySection } from '../sections/FeatureIdentitySection.js';
import type { FeatureMappingSection } from '../sections/FeatureMappingSection.js';
import type { FeatureDependencySection } from '../sections/FeatureDependencySection.js';
import type { FeatureBehaviorSection } from '../sections/FeatureBehaviorSection.js';
import type { FeatureHealthSection } from '../sections/FeatureHealthSection.js';
import type { FeatureImpactSection } from '../sections/FeatureImpactSection.js';
import type { FeatureHistorySection } from '../sections/FeatureHistorySection.js';
import type { FeatureArchitectureSection } from '../sections/FeatureArchitectureSection.js';
import type { FeatureSummarySection } from '../sections/FeatureSummarySection.js';
import type { FeatureKnowledgeReference } from './FeatureKnowledgeReference.js';
import type { FeatureKnowledgeCompleteness } from './FeatureKnowledgeCompleteness.js';
import type { FeatureKnowledgeConfidence } from './FeatureKnowledgeConfidence.js';
import type { FeatureKnowledgeFreshness } from './FeatureKnowledgeFreshness.js';
import type { FeatureKnowledgeContextPackage } from './FeatureKnowledgeContextPackage.js';

export interface FeatureKnowledgeProfile {
  featureId: string;
  identity: FeatureIdentitySection;
  mappings: FeatureMappingSection;
  dependencies: FeatureDependencySection;
  behavior: FeatureBehaviorSection;
  health: FeatureHealthSection;
  impact: FeatureImpactSection;
  history: FeatureHistorySection;
  architecture: FeatureArchitectureSection;
  summary: FeatureSummarySection;
  explanations: Record<string, string>;
  references: FeatureKnowledgeReference[];
  completeness: FeatureKnowledgeCompleteness;
  confidence: FeatureKnowledgeConfidence;
  freshness: FeatureKnowledgeFreshness;
  contextPackage?: FeatureKnowledgeContextPackage | undefined;
}
