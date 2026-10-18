import { describe, it, expect } from 'vitest';
import { FeatureKnowledgePlanner } from '../../../../src/knowledge/features/api/core/FeatureKnowledgePlanner.js';

describe('Phase 6.9 - Feature Knowledge Planner', () => {
  const planner = new FeatureKnowledgePlanner();

  it('should plan minimal execution when only IDENTITY and MAPPINGS are requested', () => {
    const plan = planner.createPlan({
      featureId: 'feat_auth',
      sections: ['IDENTITY', 'MAPPINGS'],
    });

    expect(plan.subsystemsToCall.identity).toBe(true);
    expect(plan.subsystemsToCall.mapping).toBe(true);
    expect(plan.subsystemsToCall.dependencies).toBe(false);
    expect(plan.subsystemsToCall.behavior).toBe(false);
    expect(plan.subsystemsToCall.health).toBe(false);
    expect(plan.subsystemsToCall.impact).toBe(false);
    expect(plan.subsystemsToCall.history).toBe(false);
  });

  it('should remove duplicate sections cleanly', () => {
    const plan = planner.createPlan({
      featureId: 'feat_auth',
      sections: ['IDENTITY', 'MAPPINGS', 'IDENTITY', 'MAPPINGS'],
    });

    const mappingOccurrences = Array.from(plan.resolvedSections).filter((s) => s === 'MAPPINGS');
    expect(mappingOccurrences.length).toBe(1);
  });

  it('should expand CONTEXT query into all required sections', () => {
    const plan = planner.createPlan({
      featureId: 'feat_auth',
      sections: ['CONTEXT'],
    });

    expect(plan.resolvedSections.has('IDENTITY')).toBe(true);
    expect(plan.resolvedSections.has('MAPPINGS')).toBe(true);
    expect(plan.resolvedSections.has('DEPENDENCIES')).toBe(true);
    expect(plan.resolvedSections.has('ENTRY_POINTS')).toBe(true);
    expect(plan.resolvedSections.has('BEHAVIOR')).toBe(true);
    expect(plan.resolvedSections.has('HEALTH')).toBe(true);
    expect(plan.resolvedSections.has('RISKS')).toBe(true);
    expect(plan.resolvedSections.has('HISTORY')).toBe(true);

    expect(plan.subsystemsToCall.identity).toBe(true);
    expect(plan.subsystemsToCall.mapping).toBe(true);
    expect(plan.subsystemsToCall.dependencies).toBe(true);
    expect(plan.subsystemsToCall.behavior).toBe(true);
    expect(plan.subsystemsToCall.health).toBe(true);
    expect(plan.subsystemsToCall.history).toBe(true);
  });

  it('should infer dependent sections for ENTRY_POINTS', () => {
    const plan = planner.createPlan({
      featureId: 'feat_auth',
      sections: ['ENTRY_POINTS'],
    });

    expect(plan.resolvedSections.has('MAPPINGS')).toBe(true);
    expect(plan.resolvedSections.has('BEHAVIOR')).toBe(true);
    expect(plan.subsystemsToCall.mapping).toBe(true);
    expect(plan.subsystemsToCall.behavior).toBe(true);
    expect(plan.subsystemsToCall.history).toBe(false);
  });

  it('should respect boolean exclusion flags', () => {
    const plan = planner.createPlan({
      featureId: 'feat_auth',
      includeHistory: false,
      includeHealth: false,
    });

    expect(plan.subsystemsToCall.history).toBe(false);
    expect(plan.subsystemsToCall.health).toBe(false);
    expect(plan.resolvedSections.has('HISTORY')).toBe(false);
    expect(plan.resolvedSections.has('HEALTH')).toBe(false);
  });
});
