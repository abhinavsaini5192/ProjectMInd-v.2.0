import type { ContextRelevance } from './ContextRelevance.js';
import type { ContextPriority } from './ContextPriority.js';
import type { ContextResource } from './ContextResource.js';

export type FeatureContextRole = 'DIRECT' | 'DEPENDENCY' | 'DEPENDENT' | 'INDIRECT';

export interface ContextFeature {
  featureId: string;
  name: string;
  description: string;
  type: string;
  status: string;
  role: FeatureContextRole;
  primaryRole?: string | undefined;
  relevance: ContextRelevance;
  priority: ContextPriority;
  resources: ContextResource[];
  entryPoints: string[];
  primaryFlows: string[];
  risks: string[];
  components?: string[] | undefined;
  healthSummary?: { score: number; status: string } | undefined;
  recentMilestones?: string[] | undefined;
  estimatedTokens?: number | undefined;
}
