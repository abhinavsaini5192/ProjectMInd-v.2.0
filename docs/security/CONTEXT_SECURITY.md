# ProjectMind Context Security & Cache Isolation (Phase 8.9)

## 1. Context Information Boundaries

Context packages assemble project intelligence for consumption by coding agents. Context generation must never become a side channel for unauthorized cross-tenant data leakage:
- If User A queries context for `repo-alpha`, files or features from `repo-beta` are strictly excluded, even if semantically similar or referenced in issue threads.
- All included snippets and symbol graphs are filtered against the caller's authorized scope.

## 2. Distributed Cache Isolation

Context generation results are cached to optimize latency.
- **Vulnerability**: If cache keys were merely `hash(query)`, Tenant B could query the same prompt and retrieve Tenant A's private repository context from cache.
- **Defense**: `CrossScopeGuard.buildScopedCacheKey` mandates that all cache keys incorporate the caller's workspace and repository identifiers:
  `ws:{workspaceId}:repo:{repositoryId}:{rawKey}`
- Cache key validation verifies prefix ownership before reading or writing to cache stores.
