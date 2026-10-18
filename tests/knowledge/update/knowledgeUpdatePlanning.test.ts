import { describe, it, expect, vi } from 'vitest';
import { KnowledgeUpdatePlanner } from '../../../src/knowledge/update/core/KnowledgeUpdatePlanner.js';
import { KnowledgeUpdateNormalizer } from '../../../src/knowledge/update/core/KnowledgeUpdateNormalizer.js';
import type { IKnowledgeImpactResolver } from '../../../src/knowledge/update/interfaces/IKnowledgeImpactResolver.js';

describe('KnowledgeUpdatePlanner', () => {
  const normalizer = new KnowledgeUpdateNormalizer();

  it('constructs a topologically ordered plan with dependencies and invalidation targets', async () => {
    const mockImpactResolver: IKnowledgeImpactResolver = {
      resolveImpact: vi.fn().mockResolvedValue({
        directlyAffectedFeatures: ['feat-auth'],
        downstreamAffectedFeatures: ['feat-session'],
        affectedKnowledgeAreas: [
          'FEATURE_MAPPING',
          'FEATURE_DEPENDENCIES',
          'FEATURE_BEHAVIOR',
          'FEATURE_HEALTH',
          'FEATURE_IMPACT',
          'FEATURE_HISTORY',
        ],
        dependencyPaths: [['feat-auth', 'feat-session']],
        confidence: 0.9,
      }),
      resolveBatchImpact: vi.fn(),
    };

    const planner = new KnowledgeUpdatePlanner(mockImpactResolver);

    const update = normalizer.normalize({
      repositoryId: 'repo-1',
      source: 'EXECUTION_OBSERVATION',
      updateType: 'RESOURCE_CHANGED',
      affectedResources: ['src/auth/AuthService.ts'],
      agentSessionId: 'sess-100',
    });

    const plan = await planner.plan(update);

    expect(plan.planId).toBeDefined();
    expect(plan.targetFeatures).toContain('feat-auth');
    expect(plan.targetFeatures).toContain('feat-session');
    expect(plan.targetResources).toEqual(['src/auth/AuthService.ts']);

    // Check operation stages
    const opAreas = plan.operations.map((o) => o.area);
    expect(opAreas).toContain('FEATURE_MAPPING');
    expect(opAreas).toContain('FEATURE_DEPENDENCIES');
    expect(opAreas).toContain('FEATURE_BEHAVIOR');
    expect(opAreas).toContain('FEATURE_HEALTH');
    expect(opAreas).toContain('FEATURE_IMPACT');
    expect(opAreas).toContain('FEATURE_HISTORY');

    // Check invalidation targets
    expect(plan.invalidationTargets).toContain('FEATURE_MAPPING:feat-auth');
    expect(plan.invalidationTargets).toContain('FEATURE_BEHAVIOR:feat-auth');
    expect(plan.invalidationTargets).toContain('FEATURE_HEALTH:feat-auth');
    expect(plan.invalidationTargets).toContain('CONTEXT_PACKAGE:ALL_AFFECTED');

    // Check refresh targets
    expect(plan.refreshTargets).toContain('sess-100');
  });
});
