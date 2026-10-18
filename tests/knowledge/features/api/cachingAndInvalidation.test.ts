import { describe, it, expect } from 'vitest';
import { createSyntheticAuthenticationScenario } from './ApiTestHelper.js';
import { FeatureKnowledgeCacheKeyBuilder } from '../../../../src/knowledge/features/api/cache/FeatureKnowledgeCacheKeyBuilder.js';

describe('Phase 6.9 - Caching and Invalidation', () => {
  it('should generate distinct cache keys for different section queries', () => {
    const key1 = FeatureKnowledgeCacheKeyBuilder.buildKey({
      featureId: 'feat_auth',
      sections: ['IDENTITY', 'MAPPINGS'],
    });

    const key2 = FeatureKnowledgeCacheKeyBuilder.buildKey({
      featureId: 'feat_auth',
      sections: ['IDENTITY', 'DEPENDENCIES'],
    });

    expect(key1).not.toBe(key2);
  });

  it('should generate distinct cache keys for different workspaces and versions', () => {
    const key1 = FeatureKnowledgeCacheKeyBuilder.buildKey({
      featureId: 'feat_auth',
      workspaceId: 'ws_1',
    });

    const key2 = FeatureKnowledgeCacheKeyBuilder.buildKey({
      featureId: 'feat_auth',
      workspaceId: 'ws_2',
    });

    expect(key1).not.toBe(key2);
  });

  it('should record cache misses and cache hits correctly', async () => {
    const { api, cache } = createSyntheticAuthenticationScenario();

    const statsInitial = cache.getStats();
    expect(statsInitial.hits).toBe(0);

    // First call: Miss
    await api.getFeatureKnowledge({
      featureId: 'feat_auth',
      sections: ['IDENTITY', 'MAPPINGS'],
    });

    const statsAfterMiss = cache.getStats();
    expect(statsAfterMiss.misses).toBe(1);
    expect(statsAfterMiss.hits).toBe(0);
    expect(statsAfterMiss.size).toBe(1);

    // Second identical call: Hit
    await api.getFeatureKnowledge({
      featureId: 'feat_auth',
      sections: ['IDENTITY', 'MAPPINGS'],
    });

    const statsAfterHit = cache.getStats();
    expect(statsAfterHit.hits).toBe(1);
  });

  it('should invalidate cache entries for a feature', async () => {
    const { api, cache } = createSyntheticAuthenticationScenario();

    await api.getFeatureKnowledge({
      featureId: 'feat_auth',
      sections: ['IDENTITY'],
    });

    expect(cache.getStats().size).toBe(1);

    cache.invalidateFeature('feat_auth');
    expect(cache.getStats().size).toBe(0);
  });
});
