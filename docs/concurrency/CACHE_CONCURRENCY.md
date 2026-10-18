# Cache Concurrency & Request Coalescing

## 1. Overview

Context package generation and deep repository intelligence queries are computationally expensive (AST parsing, graph traversal, and token budget optimization). When multiple agent sessions simultaneously request context for the same repository, executing duplicate computations wastes significant resources and risks cache stampedes.

---

## 2. Request Coalescing (Single-Flight)

The `RequestCoalescer` (`src/concurrency/coalescing/RequestCoalescer.ts`) ensures that only one computation executes for identical in-flight requests:

```
    Agent 1 (Request Context X) ──┐
    Agent 2 (Request Context X) ──┼──► RequestCoalescer ──► [Single Context Computation]
    Agent 3 (Request Context X) ──┘           │                         │
                                              ▼                         ▼
                                   Attach to Same Promise      Return to All 3 Agents
```

Microbenchmark throughput: **>2,000,000 calls/sec** under heavy stampede loads.

---

## 3. Security-Aware Cache Key Partitioning

Cached context or coalesced requests must **never** leak across incompatible security boundaries. Keys are built deterministically:

```typescript
coalescer.buildKey({
  workspaceId: 'ws-mind',
  repositoryId: 'repo-mind',
  principalId: 'agent-alice',
  securityScopes: ['read:features', 'read:tests'],
  knowledgeVersion: 15,
  operation: 'generate_context',
  parameters: { budget: 4000, mode: 'compact' },
});
```

### Partitioning Rules:
- Different `workspaceId` $\rightarrow$ separate key.
- Different `principalId` or `securityScopes` $\rightarrow$ separate key.
- Different `knowledgeVersion` $\rightarrow$ separate key.

---

## 4. Cache Stampede & Freshness Invariant

1. **Version Tying**: Every cached context package references the exact `knowledgeVersion` it was compiled from.
2. **Invalidation**: When `KnowledgeVersionManager` increments a repository version from 15 to 16, any cached entries for version 15 are immediately obsolete.
3. **No Overwrite by Stale Calculations**: An older calculation finishing late (version 15) is prohibited from writing to the cache if version 16 already exists.
