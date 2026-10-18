import type { ContextSection } from './ContextSection.js';
import type { ContextRequirement } from './ContextRequirement.js';
import type { ContextBudget } from './ContextBudget.js';
import type { ContextScope } from './ContextScope.js';
import type { ContextFormat } from './ContextFormat.js';

export interface ContextPlan {
  planId: string;
  targetFeatureIds: string[];
  dependentFeatureIds: string[];
  requiredSections: ContextSection[];
  requirements: ContextRequirement[];
  budget: ContextBudget;
  sectionQuotas: Record<string, number>;
  maxDepth: number;
  scope: ContextScope;
  format: ContextFormat;
  estimatedTokens: number;
  compactMode: boolean;
  createdAt: number;
}
