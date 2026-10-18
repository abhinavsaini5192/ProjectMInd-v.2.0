import type { ContextPackage } from './ContextPackage.js';
import type { ContextPlan } from './ContextPlan.js';
import type { ContextExplanation } from './ContextExplanation.js';
import type { ContextWarning } from './ContextWarning.js';

export interface ContextResponse {
  success: boolean;
  package: ContextPackage;
  formattedPrompt?: string | undefined;
  plan: ContextPlan;
  explanations?: ContextExplanation | undefined;
  warnings: ContextWarning[];
  durationMs: number;
  cached: boolean;
}
