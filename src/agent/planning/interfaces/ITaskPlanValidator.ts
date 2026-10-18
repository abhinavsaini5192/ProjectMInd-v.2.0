import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { PlanValidationResult } from '../models/PlanValidationResult.js';

export interface ITaskPlanValidator {
  validate(plan: CanonicalTaskPlan): Promise<PlanValidationResult>;
}
