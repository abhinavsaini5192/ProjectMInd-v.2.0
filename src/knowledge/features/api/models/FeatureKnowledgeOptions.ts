export type FreshnessPolicy = 'CURRENT' | 'ALLOW_STALE' | 'ANY';

export interface FeatureKnowledgeOptions {
  includeDependencies?: boolean | undefined;
  includeDependents?: boolean | undefined;
  includeBehavior?: boolean | undefined;
  includeHealth?: boolean | undefined;
  includeImpact?: boolean | undefined;
  includeHistory?: boolean | undefined;
  includeArchitecture?: boolean | undefined;
  includeSummary?: boolean | undefined;
  includeExplanations?: boolean | undefined;
  includeReferences?: boolean | undefined;
  includeContextPackage?: boolean | undefined;
  maxDepth?: number | undefined;
  maxItemsPerSection?: number | undefined;
  tokenBudget?: number | undefined;
  compactMode?: boolean | undefined;
  freshness?: FreshnessPolicy | undefined;
  knowledgeVersion?: string | undefined;
  includeInactive?: boolean | undefined;
  includeLowConfidence?: boolean | undefined;
  explainSelection?: boolean | undefined;
  requestId?: string | undefined;
}
