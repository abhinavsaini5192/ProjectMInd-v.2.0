import { describe, it, expect } from 'vitest';
import {
  createMockFeatureKnowledgeApi,
  createMockRepositories,
  AUTH_FEATURE_ID,
} from './ContextTestHelper.js';
import { ContextRetrievalCoordinator } from '../../src/context/retrieval/ContextRetrievalCoordinator.js';
import { ContextSelector } from '../../src/context/selection/ContextSelector.js';
import { ContextPlanBuilder } from '../../src/context/planning/ContextPlanBuilder.js';
import { TokenBudgetManager } from '../../src/context/budgeting/TokenBudgetManager.js';
import { ContextPackageBuilder } from '../../src/context/packing/ContextPackageBuilder.js';
import { ContextMetadataPacker } from '../../src/context/packing/ContextMetadataPacker.js';
import type { ContextRequest } from '../../src/context/models/ContextRequest.js';

describe('Context Packaging Subsystem', () => {
  const api = createMockFeatureKnowledgeApi();
  const { featureRepository, mappingRepository } = createMockRepositories();
  const coordinator = new ContextRetrievalCoordinator(api, featureRepository, mappingRepository);
  const selector = new ContextSelector();
  const budgetManager = new TokenBudgetManager();
  const packageBuilder = new ContextPackageBuilder();

  it('builds canonical ContextPackage with metadata and sections', async () => {
    const req: ContextRequest = {
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      featureIds: [AUTH_FEATURE_ID],
      taskText: 'Improve login security',
    };
    const plan = ContextPlanBuilder.buildPlan(req, [AUTH_FEATURE_ID]);
    const retrieved = await coordinator.retrieveContext(plan, req);
    const selected = selector.select(retrieved, plan, req);
    const budgeted = budgetManager.applyBudget(selected, plan.budget);

    const pkg = packageBuilder.buildPackage({
      request: req,
      plan,
      selected: budgeted.data,
      allocation: budgeted.allocation,
      warnings: [...retrieved.warnings, ...budgeted.warnings],
      retrieved,
    });

    expect(pkg.packageId).toBeDefined();
    expect(pkg.features.length).toBeGreaterThan(0);
    expect(pkg.resources.length).toBeGreaterThan(0);
    expect(pkg.behavior.length).toBeGreaterThan(0);
    expect(pkg.health).toBeDefined();
    expect(pkg.completeness).toBeDefined();
    expect(pkg.completeness.score).toBeGreaterThan(0);
    expect(pkg.freshness.status).toBe('CURRENT');
    expect(pkg.version.packageVersion).toBe('6.10.0');
  });

  it('computes completeness level correctly based on section coverage', () => {
    const plan = ContextPlanBuilder.buildPlan(
      {
        repositoryId: 'repo-1',
        workspaceId: 'ws-1',
        featureIds: ['f1'],
        requestedSections: ['IDENTITY', 'RESOURCES', 'BEHAVIOR', 'HEALTH'],
      },
      ['f1']
    );

    const completeness = ContextMetadataPacker.computeCompleteness(plan, {
      features: [{ featureId: 'f1', name: 'F1' } as any],
      resources: [{ resourceId: 'r1' } as any],
      behaviorFlows: [],
      tests: [],
      risks: [],
      milestones: [],
      explanations: {},
    });

    expect(completeness.level).toBeDefined();
    expect(completeness.score).toBeLessThan(1.0);
  });
});
