import type { ContextRequest } from '../models/ContextRequest.js';
import type { ContextPlan } from '../models/ContextPlan.js';
import type { ContextBudget } from '../models/ContextBudget.js';
import type { ContextSection } from '../models/ContextSection.js';
import { DEFAULT_CONTEXT_BUDGET } from '../models/ContextBudget.js';
import { ContextScopeResolver } from './ContextScopeResolver.js';
import { ContextRequirementResolver } from './ContextRequirementResolver.js';
import { ContextDependencyResolver } from './ContextDependencyResolver.js';

const SECTION_WEIGHTS: Record<ContextSection, number> = {
  IDENTITY: 5,
  RESOURCES: 30,
  ENTRY_POINTS: 10,
  BEHAVIOR: 20,
  DEPENDENCIES: 10,
  TESTS: 10,
  HEALTH: 5,
  IMPACT: 10,
  HISTORY: 5,
  ARCHITECTURE: 5,
  METADATA: 3,
  WARNINGS: 2,
  EXPLANATIONS: 5,
};

export class ContextPlanBuilder {
  public static buildPlan(
    request: ContextRequest,
    targetFeatureIds: string[],
    dependentFeatureIds: string[] = []
  ): ContextPlan {
    const scope = ContextScopeResolver.resolveScope(request);
    const requiredSections = ContextRequirementResolver.resolveRequiredSections(request);
    const requirements = ContextRequirementResolver.resolveRequirements(request, targetFeatureIds);
    const maxDepth = ContextDependencyResolver.resolveMaxDepth(request);

    const totalBudget = request.tokenBudget ?? DEFAULT_CONTEXT_BUDGET.totalBudget;
    const reservedForPrompt = Math.min(500, Math.floor(totalBudget * 0.125));
    const reservedForMetadata = Math.min(300, Math.floor(totalBudget * 0.075));
    const availableForContext = Math.max(100, totalBudget - reservedForPrompt - reservedForMetadata);
    const compactMode = request.compactMode ?? totalBudget < 2000;

    const budget: ContextBudget = {
      totalBudget,
      reservedForPrompt,
      reservedForMetadata,
      availableForContext,
      compactMode,
    };

    // Calculate section quotas based on active sections
    const activeWeights = requiredSections.map((s) => ({ section: s, weight: SECTION_WEIGHTS[s] ?? 5 }));
    const totalWeight = activeWeights.reduce((acc, curr) => acc + curr.weight, 0);

    const sectionQuotas: Record<string, number> = {};
    for (const { section, weight } of activeWeights) {
      sectionQuotas[section] = Math.floor((weight / totalWeight) * availableForContext);
    }

    const planId = `plan-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return {
      planId,
      targetFeatureIds,
      dependentFeatureIds,
      requiredSections,
      requirements,
      budget,
      sectionQuotas,
      maxDepth,
      scope,
      format: request.outputFormat ?? 'generic-markdown',
      estimatedTokens: availableForContext,
      compactMode,
      createdAt: Date.now(),
    };
  }
}
