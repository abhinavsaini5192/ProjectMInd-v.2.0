import type { ContextSection } from './ContextSection.js';
import type { ContextPriority } from './ContextPriority.js';

export interface ContextRequirement {
  id: string;
  type: ContextSection;
  priority: ContextPriority;
  required: boolean;
  reason: string;
  targetFeatureId?: string | undefined;
  maxItems?: number | undefined;
  tokenBudget?: number | undefined;
  confidenceThreshold?: number | undefined;
  freshnessPolicy?: string | undefined;
}
