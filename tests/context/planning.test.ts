import { describe, it, expect } from 'vitest';
import { ContextPlanner } from '../../src/context/planning/ContextPlanner.js';
import { ContextPlanBuilder } from '../../src/context/planning/ContextPlanBuilder.js';
import { ContextPriorityResolver } from '../../src/context/planning/ContextPriorityResolver.js';
import { ContextRequirementResolver } from '../../src/context/planning/ContextRequirementResolver.js';
import type { ContextRequest } from '../../src/context/models/ContextRequest.js';

describe('Context Planning Subsystem', () => {
  const planner = new ContextPlanner();

  const baseRequest: ContextRequest = {
    repositoryId: 'repo-mind',
    workspaceId: 'ws-mind',
    featureIds: ['feat_auth_01'],
    tokenBudget: 4000,
  };

  it('constructs a valid ContextPlan with calculated quotas', () => {
    const plan = planner.planContext(baseRequest);

    expect(plan.planId).toBeDefined();
    expect(plan.targetFeatureIds).toContain('feat_auth_01');
    expect(plan.budget.totalBudget).toBe(4000);
    expect(plan.budget.availableForContext).toBeGreaterThan(2000);
    expect(plan.requiredSections).toContain('IDENTITY');
    expect(plan.requiredSections).toContain('RESOURCES');
    expect(plan.sectionQuotas['RESOURCES']).toBeGreaterThan(plan.sectionQuotas['IDENTITY']!);
    expect(plan.format).toBe('generic-markdown');
  });

  it('honors explicitly requested sections', () => {
    const req: ContextRequest = {
      ...baseRequest,
      requestedSections: ['IDENTITY', 'BEHAVIOR', 'HEALTH'],
    };
    const sections = ContextRequirementResolver.resolveRequiredSections(req);
    expect(sections).toContain('IDENTITY');
    expect(sections).toContain('BEHAVIOR');
    expect(sections).toContain('HEALTH');
    expect(sections).toContain('METADATA'); // Always added
  });

  it('activates compact mode when token budget is constrained', () => {
    const tightPlan = ContextPlanBuilder.buildPlan(
      { ...baseRequest, tokenBudget: 1500 },
      ['feat_auth_01']
    );
    expect(tightPlan.compactMode).toBe(true);

    const normalPlan = ContextPlanBuilder.buildPlan(
      { ...baseRequest, tokenBudget: 8000 },
      ['feat_auth_01']
    );
    expect(normalPlan.compactMode).toBe(false);
  });

  it('resolves correct section and resource priorities', () => {
    expect(ContextPriorityResolver.resolveSectionPriority('IDENTITY')).toBe('CRITICAL');
    expect(ContextPriorityResolver.resolveSectionPriority('RESOURCES')).toBe('CRITICAL');
    expect(ContextPriorityResolver.resolveSectionPriority('IMPACT', true)).toBe('CRITICAL');
    expect(ContextPriorityResolver.resolveSectionPriority('IMPACT', false)).toBe('HIGH');
    expect(ContextPriorityResolver.resolveSectionPriority('HISTORY')).toBe('LOW');

    expect(ContextPriorityResolver.resolveResourcePriority(true, false, false)).toBe('CRITICAL');
    expect(ContextPriorityResolver.resolveResourcePriority(false, true, false)).toBe('HIGH');
    expect(ContextPriorityResolver.resolveResourcePriority(false, false, false)).toBe('MEDIUM');
  });
});
