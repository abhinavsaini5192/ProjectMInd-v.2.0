# Caching & Invalidation Architecture

## Cache Strategy

The Feature Knowledge API integrates caching exclusively through the ProjectMind cache abstraction (`FeatureKnowledgeCache`).

---

## Cache Key Composition

Cache keys must incorporate all query dimensions that affect query results:

```typescript
export class FeatureKnowledgeCacheKeyBuilder {
  public static buildKey(query: FeatureKnowledgeQuery): string {
    const ws = query.workspaceId || 'default_ws';
    const repo = query.repositoryId || 'default_repo';
    const fid = query.featureId;
    const sections = query.sections ? [...query.sections].sort().join(',') : 'ALL';
    const depth = query.maxDepth ?? 'default_depth';
    const budget = query.tokenBudget ?? 'default_budget';
    const freshness = query.freshness ?? 'CURRENT';
    const version = query.knowledgeVersion ?? 'latest';
    const compact = query.compactMode ? '1' : '0';
    const inactive = query.includeInactive ? '1' : '0';

    return `${ws}:${repo}:${fid}:${sections}:${depth}:${budget}:${freshness}:${version}:${compact}:${inactive}`;
  }
}
```

This prevents collisions where:
- A query for `['IDENTITY', 'MAPPINGS']` would otherwise erroneously return a cached response that only contained `['IDENTITY']`.
- A query under one workspace returns data from another.
- Different token budgets produce colliding packages.

---

## Invalidation Mechanics

`FeatureKnowledgeCache` supports targeted invalidation:
```typescript
cache.invalidateFeature(featureId); // Clears all queries referencing this feature
cache.invalidateAll();              // Clears entire cache
```

When background events occur in earlier phases (e.g. `FeatureMappingUpdated`, `FeatureHealthUpdated`), the respective feature cache entries are purged without recreating a redundant event bus.
