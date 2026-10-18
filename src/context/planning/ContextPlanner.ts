import type { IContextPlanner } from '../interfaces/IContextPlanner.js';
import type { ContextRequest } from '../models/ContextRequest.js';
import type { ContextPlan } from '../models/ContextPlan.js';
import { ContextPlanValidator } from './ContextPlanValidator.js';
import { ContextPlanBuilder } from './ContextPlanBuilder.js';

export class ContextPlanner implements IContextPlanner {
  public planContext(request: ContextRequest, resolvedFeatureIds: string[] = []): ContextPlan {
    // Validate request
    ContextPlanValidator.validate(request, resolvedFeatureIds);

    // If explicit featureIds are provided in the request, prioritize them or combine them with resolved
    const targetFeatureIds = Array.from(
      new Set([...(request.featureIds ?? []), ...resolvedFeatureIds])
    );

    return ContextPlanBuilder.buildPlan(request, targetFeatureIds);
  }
}
