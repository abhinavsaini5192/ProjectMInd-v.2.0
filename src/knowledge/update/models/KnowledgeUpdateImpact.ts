import type { KnowledgeArea } from './KnowledgeArea.js';

export interface KnowledgeUpdateImpact {
  readonly resourceId?: string | undefined;
  readonly featureId?: string | undefined;
  readonly directlyAffectedFeatures: readonly string[];
  readonly downstreamAffectedFeatures: readonly string[];
  readonly affectedKnowledgeAreas: readonly KnowledgeArea[];
  readonly dependencyPaths: readonly (readonly string[])[];
  readonly confidence: number;
  readonly reason?: string | undefined;
}
