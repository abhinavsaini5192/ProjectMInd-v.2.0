import { describe, it, expect } from 'vitest';
import { createSyntheticAuthenticationScenario, createMockFeatureRepository, createMockHealthRepository } from './ApiTestHelper.js';
import { FeatureKnowledgePlanner } from '../../../../src/knowledge/features/api/core/FeatureKnowledgePlanner.js';
import { FeatureKnowledgeFreshnessResolver } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeFreshnessResolver.js';
import { FeatureKnowledgeExplainer } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeExplainer.js';
import { FeatureKnowledgeResolver } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeResolver.js';
import { FeatureKnowledgeAssembler } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeAssembler.js';
import { FeatureKnowledgeQueryService } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeQueryService.js';
import { FeatureKnowledgeAPI } from '../../../../src/knowledge/features/api/core/FeatureKnowledgeAPI.js';
import { FeatureKnowledgeQueryError } from '../../../../src/knowledge/features/api/errors/FeatureKnowledgeQueryError.js';

describe('Phase 6.9 - Freshness and Versioning Model', () => {
  it('should detect CURRENT freshness and CONSISTENT version on up-to-date feature', async () => {
    const { api } = createSyntheticAuthenticationScenario();
    const res = await api.getFeatureKnowledge({
      featureId: 'feat_auth',
      sections: ['IDENTITY', 'MAPPINGS'],
    });

    expect(res.metadata.freshness.status).toBe('CURRENT');
    expect(res.metadata.versionStatus.consistencyStatus).toBe('CONSISTENT');
    expect(res.metadata.versionStatus.aggregateVersion).toBe('1.0.0');
    expect(res.metadata.versionStatus.mismatches.length).toBe(0);
  });

  it('should detect STALE status when section contains stale data', async () => {
    const feature = { id: 'feat_stale', name: 'Stale Feature', description: 'desc' };
    const staleHealth = {
      featureId: 'feat_stale',
      healthScore: 50,
      status: 'DEGRADED',
      isStale: true, // Marked stale
      assessedAt: Date.now() - 100000000,
    };

    const resolver = new FeatureKnowledgeResolver({
      featureRepository: createMockFeatureRepository([feature]),
      healthRepository: createMockHealthRepository({ feat_stale: staleHealth }),
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
      featureId: 'feat_stale',
      sections: ['HEALTH'],
      freshness: 'ALLOW_STALE',
    });

    expect(res.metadata.freshness.status).toBe('STALE');
    expect(res.metadata.freshness.invalidationReason).toBeDefined();
  });

  it('should reject stale knowledge when freshness policy is CURRENT', async () => {
    const feature = { id: 'feat_stale', name: 'Stale Feature', description: 'desc' };
    const staleHealth = {
      featureId: 'feat_stale',
      healthScore: 50,
      status: 'DEGRADED',
      isStale: true,
    };

    const resolver = new FeatureKnowledgeResolver({
      featureRepository: createMockFeatureRepository([feature]),
      healthRepository: createMockHealthRepository({ feat_stale: staleHealth }),
    });

    const queryService = new FeatureKnowledgeQueryService({
      planner: new FeatureKnowledgePlanner(),
      resolver,
      freshnessResolver: new FeatureKnowledgeFreshnessResolver(),
      explainer: new FeatureKnowledgeExplainer(),
      assembler: new FeatureKnowledgeAssembler(),
    });
    const api = new FeatureKnowledgeAPI(queryService);

    await expect(
      api.getFeatureKnowledge({
        featureId: 'feat_stale',
        sections: ['HEALTH'],
        freshness: 'CURRENT',
      })
    ).rejects.toThrow(FeatureKnowledgeQueryError);
  });

  it('should detect VERSION_MISMATCH when requested knowledgeVersion differs', async () => {
    const { api } = createSyntheticAuthenticationScenario();
    const res = await api.getFeatureKnowledge({
      featureId: 'feat_auth',
      sections: ['IDENTITY', 'MAPPINGS'],
      knowledgeVersion: '2.5.0', // Differs from 1.0.0
      freshness: 'ANY',
    });

    expect(res.metadata.freshness.status).toBe('VERSION_MISMATCH');
    expect(res.metadata.versionStatus.consistencyStatus).toBe('INCONSISTENT');
    expect(res.metadata.versionStatus.mismatches.length).toBeGreaterThan(0);
  });
});
