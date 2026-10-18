import type { FeatureKnowledgeQuery } from '../models/FeatureKnowledgeQuery.js';
import type { FeatureKnowledgeSection } from '../models/FeatureKnowledgeSection.js';

export interface FeatureKnowledgeExecutionPlan {
  featureId: string;
  resolvedSections: Set<FeatureKnowledgeSection>;
  subsystemsToCall: {
    identity: boolean;
    mapping: boolean;
    dependencies: boolean;
    behavior: boolean;
    health: boolean;
    impact: boolean;
    history: boolean;
    architecture: boolean;
  };
  options: {
    maxDepth?: number | undefined;
    maxItemsPerSection?: number | undefined;
    tokenBudget?: number | undefined;
    compactMode?: boolean | undefined;
  };
}

export interface IFeatureKnowledgePlanner {
  createPlan(query: FeatureKnowledgeQuery): FeatureKnowledgeExecutionPlan;
}
