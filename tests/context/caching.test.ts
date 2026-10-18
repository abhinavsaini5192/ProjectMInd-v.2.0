import { describe, it, expect } from 'vitest';
import { ContextCache } from '../../src/context/cache/ContextCache.js';
import { ContextCacheKeyBuilder } from '../../src/context/cache/ContextCacheKeyBuilder.js';
import type { ContextResponse } from '../../src/context/models/ContextResponse.js';

describe('Context Caching Subsystem', () => {
  it('generates consistent cache keys for identical requests', () => {
    const key1 = ContextCacheKeyBuilder.buildKey({
      repositoryId: 'repo-1',
      workspaceId: 'ws-1',
      featureIds: ['feat-b', 'feat-a'],
      tokenBudget: 4000,
    });

    const key2 = ContextCacheKeyBuilder.buildKey({
      repositoryId: 'repo-1',
      workspaceId: 'ws-1',
      featureIds: ['feat-a', 'feat-b'],
      tokenBudget: 4000,
    });

    expect(key1).toBe(key2);
  });

  it('stores and retrieves cached context responses', () => {
    const cache = new ContextCache(5000);
    const mockResp = { success: true } as ContextResponse;

    cache.set('key-1', mockResp, 'repo-1');
    expect(cache.get('key-1')).toBe(mockResp);
    expect(cache.size()).toBe(1);
  });

  it('invalidates cache entries by repositoryId', () => {
    const cache = new ContextCache(5000);
    const mockResp = { success: true } as ContextResponse;

    cache.set('key-repo1-a', mockResp, 'repo-1');
    cache.set('key-repo1-b', mockResp, 'repo-1');
    cache.set('key-repo2-a', mockResp, 'repo-2');

    expect(cache.size()).toBe(3);
    cache.invalidateRepository('repo-1');
    expect(cache.size()).toBe(1);
    expect(cache.get('key-repo1-a')).toBeUndefined();
    expect(cache.get('key-repo2-a')).toBe(mockResp);
  });

  it('expires entries after TTL', async () => {
    const shortCache = new ContextCache(50); // 50ms TTL
    const mockResp = { success: true } as ContextResponse;

    shortCache.set('key-exp', mockResp, 'repo-1');
    expect(shortCache.get('key-exp')).toBe(mockResp);

    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(shortCache.get('key-exp')).toBeUndefined();
  });
});
