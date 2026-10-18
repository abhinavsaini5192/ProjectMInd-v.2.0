import type { FeatureKnowledgeSection } from './FeatureKnowledgeSection.js';
import type { FeatureKnowledgeOptions } from './FeatureKnowledgeOptions.js';

export interface FeatureKnowledgeQuery extends FeatureKnowledgeOptions {
  featureId: string;
  workspaceId?: string | undefined;
  repositoryId?: string | undefined;
  sections?: FeatureKnowledgeSection[] | undefined;
}
