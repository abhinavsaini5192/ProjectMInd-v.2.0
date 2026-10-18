import { describe, it, expect } from 'vitest';
import {
  createMockFeatureKnowledgeApi,
  createMockRepositories,
  AUTH_FEATURE_ID,
  CHECKOUT_FEATURE_ID,
} from './ContextTestHelper.js';
import { ContextRetrievalCoordinator } from '../../src/context/retrieval/ContextRetrievalCoordinator.js';
import { ContextSelector } from '../../src/context/selection/ContextSelector.js';
import { ContextPlanBuilder } from '../../src/context/planning/ContextPlanBuilder.js';
import { ContextDeduplicator } from '../../src/context/selection/ContextDeduplicator.js';
import type { ContextRequest } from '../../src/context/models/ContextRequest.js';

describe('Context Selection & Scoring Subsystem', () => {
  const api = createMockFeatureKnowledgeApi();
  const { featureRepository, mappingRepository } = createMockRepositories();
  const coordinator = new ContextRetrievalCoordinator(api, featureRepository, mappingRepository);
  const selector = new ContextSelector();

  it('selects and ranks features by relevance score', async () => {
    const req: ContextRequest = {
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      featureIds: [AUTH_FEATURE_ID],
      taskText: 'Debug login issue in authentication',
      maxDepth: 1,
    };
    const plan = ContextPlanBuilder.buildPlan(req, [AUTH_FEATURE_ID]);
    const retrieved = await coordinator.retrieveContext(plan, req);
    const selected = selector.select(retrieved, plan, req);

    expect(selected.features.length).toBeGreaterThanOrEqual(2);
    // Directly requested feature should have higher score than indirect dependency
    const authFeat = selected.features.find((f) => f.featureId === AUTH_FEATURE_ID);
    const chkFeat = selected.features.find((f) => f.featureId === CHECKOUT_FEATURE_ID);

    expect(authFeat).toBeDefined();
    expect(chkFeat).toBeDefined();
    expect(authFeat!.role).toBe('DIRECT');
    expect(chkFeat!.role).toBe('DEPENDENCY');
    expect(authFeat!.relevance.score).toBeGreaterThan(chkFeat!.relevance.score);
  });

  it('selects resources with primary role prioritized', async () => {
    const req: ContextRequest = {
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      featureIds: [AUTH_FEATURE_ID],
    };
    const plan = ContextPlanBuilder.buildPlan(req, [AUTH_FEATURE_ID]);
    const retrieved = await coordinator.retrieveContext(plan, req);
    const selected = selector.select(retrieved, plan, req);

    expect(selected.resources.length).toBeGreaterThan(0);
    const primary = selected.resources.find((r) => r.role === 'PRIMARY');
    expect(primary).toBeDefined();
    expect(primary!.priority).toBe('HIGH');
  });

  it('deduplicates resources with identical paths correctly', () => {
    const duplicateList = [
      {
        resourceId: 'res-1',
        filePath: 'src/auth/AuthService.ts',
        role: 'SECONDARY',
        featureId: 'feat-1',
        relevance: { score: 0.5, confidence: 1, importance: 0.5, directness: false, reasons: [] },
        priority: 'MEDIUM' as const,
      },
      {
        resourceId: 'res-2',
        filePath: 'src/auth/AuthService.ts',
        role: 'PRIMARY',
        featureId: 'feat-2',
        relevance: { score: 0.9, confidence: 1, importance: 0.9, directness: true, reasons: [] },
        priority: 'HIGH' as const,
      },
    ];

    const deduplicated = ContextDeduplicator.deduplicateResources(duplicateList);
    expect(deduplicated.length).toBe(1);
    expect(deduplicated[0]!.relevance.score).toBe(0.9);
  });
});
