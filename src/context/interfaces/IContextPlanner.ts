import type { ContextRequest } from '../models/ContextRequest.js';
import type { ContextPlan } from '../models/ContextPlan.js';

export interface IContextPlanner {
  planContext(request: ContextRequest, resolvedFeatureIds: string[]): Promise<ContextPlan> | ContextPlan;
}
