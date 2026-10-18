# Caching & Freshness Policies

## Overview

Generating deep repository context requires multi-subsystem queries. To maintain sub-second response times while ensuring accuracy, the Context Orchestrator includes `ContextCache` and deterministic cache key generation.

## Freshness Policies

| Policy | Behavior |
| :--- | :--- |
| **`CURRENT`** (Default) | Always recomputes fresh context from Phase 6.9 `FeatureKnowledgeAPI`. Bypasses cache reads. Updates cache on completion. |
| **`ALLOW_STALE`** | Serves from cache if a valid (non-expired) entry exists for the request key. |
| **`ANY`** | Returns cached data regardless of minor staleness if TTL has not expired. |

## Cache Key Determinism

Cache keys are constructed by `ContextCacheKeyBuilder` from:
- `repositoryId`
- `workspaceId`
- Sorted `featureIds`
- Sorted `resourceIds`
- Sorted `changedResources`
- `taskText`
- `tokenBudget`
- `outputFormat`
- `maxDepth`
- `compactMode`

Format: `ctx:<repo>:<ws>:<features>:<resources>:<changed>:<task>:<budget>:<format>:<depth>:<compact>`.

## Cache Invalidation

When repository changes occur:
- `cache.invalidateRepository(repositoryId)` clears all cached context responses for that repository.
- Individual entries expire based on TTL (default: 60,000 ms).
