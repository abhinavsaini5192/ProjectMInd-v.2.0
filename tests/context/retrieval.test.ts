import { describe, it, expect } from 'vitest';
import {
  createMockFeatureKnowledgeApi,
  createMockRepositories,
  AUTH_FEATURE_ID,
  CHECKOUT_FEATURE_ID,
} from './ContextTestHelper.js';
import { ContextRetrievalCoordinator } from '../../src/context/retrieval/ContextRetrievalCoordinator.js';
import { ContextPlanBuilder } from '../../src/context/planning/ContextPlanBuilder.js';
import type { ContextRequest } from '../../src/context/models/ContextRequest.js';

describe('Context Retrieval Subsystem', () => {
  const api = createMockFeatureKnowledgeApi();
  const { featureRepository, mappingRepository } = createMockRepositories();
  const coordinator = new ContextRetrievalCoordinator(api, featureRepository, mappingRepository);

  it('retrieves explicit target feature knowledge and dependencies', async () => {
    const req: ContextRequest = {
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      featureIds: [AUTH_FEATURE_ID],
      maxDepth: 1,
    };
    const plan = ContextPlanBuilder.buildPlan(req, [AUTH_FEATURE_ID]);
    const retrieved = await coordinator.retrieveContext(plan, req);

    expect(retrieved.resolvedDirectFeatures).toContain(AUTH_FEATURE_ID);
    expect(retrieved.resolvedDependencyFeatures).toContain(CHECKOUT_FEATURE_ID);
    expect(retrieved.featureKnowledgeMap.has(AUTH_FEATURE_ID)).toBe(true);
    expect(retrieved.featureKnowledgeMap.has(CHECKOUT_FEATURE_ID)).toBe(true);
    expect(retrieved.impactMap.has(AUTH_FEATURE_ID)).toBe(true);
  });

  it('resolves target features from changed resources', async () => {
    const req: ContextRequest = {
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      changedResources: ['src/auth/AuthService.ts'],
    };
    const plan = ContextPlanBuilder.buildPlan(req, []);
    const retrieved = await coordinator.retrieveContext(plan, req);

    expect(retrieved.resolvedDirectFeatures).toContain(AUTH_FEATURE_ID);
    expect(retrieved.featureKnowledgeMap.has(AUTH_FEATURE_ID)).toBe(true);
  });

  it('resolves target features from task text keyword match', async () => {
    const req: ContextRequest = {
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      taskText: 'Fix timeout issue in Authentication Service login flow',
    };
    const plan = ContextPlanBuilder.buildPlan(req, []);
    const retrieved = await coordinator.retrieveContext(plan, req);

    expect(retrieved.resolvedDirectFeatures).toContain(AUTH_FEATURE_ID);
  });

  it('emits warning when feature is not found', async () => {
    const req: ContextRequest = {
      repositoryId: 'repo-mind',
      workspaceId: 'ws-mind',
      featureIds: ['non_existent_feature_999'],
    };
    const plan = ContextPlanBuilder.buildPlan(req, ['non_existent_feature_999']);
    const retrieved = await coordinator.retrieveContext(plan, req);

    expect(retrieved.warnings.some((w) => w.type === 'UNRESOLVED_FEATURE')).toBe(true);
  });
});
