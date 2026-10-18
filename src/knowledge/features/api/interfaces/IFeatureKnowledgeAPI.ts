import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import type { FeatureKnowledgeOptions } from '../models/FeatureKnowledgeOptions.js';
import type { FeatureKnowledgeResponse } from '../models/FeatureKnowledgeResponse.js';
import type { FeatureKnowledgeSummary } from '../models/FeatureKnowledgeSummary.js';
import type { FeatureKnowledgeContextPackage } from '../models/FeatureKnowledgeContextPackage.js';
import type { FeatureKnowledgeCompleteness } from '../models/FeatureKnowledgeCompleteness.js';
import type { FeatureKnowledgeFreshness } from '../models/FeatureKnowledgeFreshness.js';
import type { FeatureKnowledgeVersion } from '../models/FeatureKnowledgeVersion.js';
import type { FeatureMappingSection } from '../sections/FeatureMappingSection.js';
import type { FeatureDependencySection } from '../sections/FeatureDependencySection.js';
import type { FeatureBehaviorSection } from '../sections/FeatureBehaviorSection.js';
import type { FeatureHealthSection } from '../sections/FeatureHealthSection.js';
import type { FeatureImpactSection } from '../sections/FeatureImpactSection.js';
import type { FeatureHistorySection } from '../sections/FeatureHistorySection.js';
import type { FeatureArchitectureSection } from '../sections/FeatureArchitectureSection.js';

export interface IFeatureKnowledgeAPI {
  getFeatureKnowledge(
    queryOrId: FeatureKnowledgeQuery | string
  ): Promise<FeatureKnowledgeResponse>;

  getFeatureProfile(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureKnowledgeResponse>;

  getFeatureSummary(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureKnowledgeSummary>;

  getFeatureMappings(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureMappingSection>;

  getFeatureDependencies(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureDependencySection>;

  getFeatureDependents(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureDependencySection>;

  getFeatureBehavior(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureBehaviorSection>;

  getFeatureHealth(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureHealthSection>;

  getFeatureImpact(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureImpactSection>;

  getFeatureHistory(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureHistorySection>;

  getFeatureArchitecture(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureArchitectureSection>;

  getFeatureContext(
    featureId: string,
    options?: FeatureKnowledgeOptions | undefined
  ): Promise<FeatureKnowledgeContextPackage>;

  explainFeatureKnowledge(
    query: FeatureKnowledgeQuery
  ): Promise<Record<string, string>>;

  getKnowledgeCompleteness(
    query: FeatureKnowledgeQuery
  ): Promise<FeatureKnowledgeCompleteness>;

  getKnowledgeFreshness(
    query: FeatureKnowledgeQuery
  ): Promise<FeatureKnowledgeFreshness>;

  getKnowledgeVersionStatus(
    query: FeatureKnowledgeQuery
  ): Promise<FeatureKnowledgeVersion>;
}
