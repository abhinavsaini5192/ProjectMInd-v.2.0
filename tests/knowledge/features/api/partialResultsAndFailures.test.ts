import { describe, it, expect } from 'vitest';
import {
  createMockFeatureRepository,
  createMockMappingRepository,
  createMockRelationshipRepository,
  createMockBehaviorRepository,
  createMockHealthRepository,
  createMockImpactRepository,
  createMockHistoryRepository,
} from './ApiTestHelper.js';
import { FeatureKnowledgePlanner } from '../../../../src/knowledge/features/api/core/FeatureKnowledgePlanner.js';
import { FeatureKnowledgeFreshnessResolver } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeFreshnessResolver.js';
import { FeatureKnowledgeExplainer } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeExplainer.js';
import { FeatureKnowledgeResolver } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeResolver.js';
import { FeatureKnowledgeAssembler } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeAssembler.js';
import { FeatureKnowledgeQueryService } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeQueryService.js';
import { FeatureKnowledgeAPI } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeAPI.js';

describe('Phase 6.9 - Partial Results and Provider Failures', () => {
  const feature = {
    id: 'feat_partial',
    name: 'Partial Feature',
    description: 'Feature with partial/failing providers',
    type: 'INTERNAL',
    status: 'ACTIVE',
  };

  it('should preserve profile when one provider throws an error', async () => {
    const featureRepo = createMockFeatureRepository([feature]);
    const mappingRepo = createMockMappingRepository({ feat_partial: [] });
    // Failing behavior repository:
    const failingBehaviorRepo = {
      ...createMockBehaviorRepository(),
      getBehavior: async () => {
        throw new Error('Database connection timeout in BehaviorEngine');
      },
    };

    const resolver = new FeatureKnowledgeResolver({
      featureRepository: featureRepo,
      mappingRepository: mappingRepo,
      behaviorRepository: failingBehaviorRepo,
    });

    const queryService = new FeatureKnowledgeQueryService({
      planner: new FeatureKnowledgePlanner(),
      resolver,
      freshnessResolver: new FeatureKnowledgeFreshnessResolver(),
      explainer: new FeatureKnowledgeExplainer(),
      assembler: new FeatureKnowledgeAssembler(),
    });
    const api = new FeatureKnowledgeAPI(queryService);

    const res = await api.getFeatureKnowledge({
      featureId: 'feat_partial',
      sections: ['IDENTITY', 'MAPPINGS', 'BEHAVIOR'],
    });

    expect(res.profile.identity.status).toBe('AVAILABLE');
    expect(res.profile.mappings.status).toBe('EMPTY');
    expect(res.profile.behavior.status).toBe('FAILED');
    expect(res.profile.behavior.error?.code).toBe('BEHAVIOR_RETRIEVAL_FAILED');
    expect(res.profile.behavior.error?.message).toContain('Database connection timeout');
    expect(res.errors?.length).toBe(1);
  });

  it('should mark unconfigured repository as NOT_COMPUTED', async () => {
    const featureRepo = createMockFeatureRepository([feature]);
    // Only feature repository configured, no healthRepo
    const resolver = new FeatureKnowledgeResolver({
      featureRepository: featureRepo,
    });

    const queryService = new FeatureKnowledgeQueryService({
      planner: new FeatureKnowledgePlanner(),
      resolver,
      freshnessResolver: new FeatureKnowledgeFreshnessResolver(),
      explainer: new FeatureKnowledgeExplainer(),
      assembler: new FeatureKnowledgeAssembler(),
    });
    const api = new FeatureKnowledgeAPI(queryService);

    const res = await api.getFeatureKnowledge({
      featureId: 'feat_partial',
      sections: ['HEALTH'],
    });

    expect(res.profile.health.status).toBe('NOT_COMPUTED');
    expect(res.profile.health.reason).toContain('not configured');
  });

  it('should distinguish EMPTY from NOT_COMPUTED', async () => {
    const featureRepo = createMockFeatureRepository([feature]);
    const mappingRepo = createMockMappingRepository({ feat_partial: [] });
    const healthRepo = {
      ...createMockHealthRepository(),
      getByFeatureId: async () => null, // Analysis not run
    };

    const resolver = new FeatureKnowledgeResolver({
      featureRepository: featureRepo,
      mappingRepository: mappingRepo,
      healthRepository: healthRepo,
    });

    const queryService = new FeatureKnowledgeQueryService({
      planner: new FeatureKnowledgePlanner(),
      resolver,
      freshnessResolver: new FeatureKnowledgeFreshnessResolver(),
      explainer: new FeatureKnowledgeExplainer(),
      assembler: new FeatureKnowledgeAssembler(),
    });
    const api = new FeatureKnowledgeAPI(queryService);

    const res = await api.getFeatureKnowledge({
      featureId: 'feat_partial',
      sections: ['MAPPINGS', 'HEALTH'],
    });

    expect(res.profile.mappings.status).toBe('EMPTY');
    expect(res.profile.health.status).toBe('NOT_COMPUTED');
    expect(res.profile.health.reason).toBe('Health analysis has not been run');
  });
});
