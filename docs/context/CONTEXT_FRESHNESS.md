# Context Freshness, Caching & Targeted Invalidation

## 1. Context Freshness States

Context tracks the freshness of underlying knowledge and repository state:
- `CURRENT` / `FRESH`: Knowledge graph is aligned with the active working tree and commit state.
- `RECENT`: Knowledge is fresh within acceptable time drift ($< 5$ minutes).
- `STALE`: Repository files or knowledge mappings have changed since generation.
- `VERSION_MISMATCH`: Target knowledge version differs from active repository schema.
- `UNKNOWN`: Unverified freshness state.

## 2. Project-Aware Context Cache

The [`ContextCacheKeyBuilder`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/cache/ContextCacheKeyBuilder.ts) builds deterministic cache keys incorporating security and scope boundaries:

```
ctx:<workspaceId>:<projectId>:<repositoryId>:<features>:<resources>:<changed>:<taskText>:<budget>:<format>:<depth>:<compact>:<compression>:<knowledgeVersion>
```

This guarantees:
- **No Cross-Project Cache Contamination**: Project A cache hits can never satisfy Project B requests.
- **Version Isolation**: Changing the repository or knowledge version instantly evades stale cache entries.

## 3. Targeted Invalidation via Knowledge Update Loop

When an engineer or background job modifies source code:
- Only features directly containing the modified files or upstream dependencies are invalidated.
- Contexts for unrelated modules (e.g. `Payment` contexts when `Auth` files are touched) remain completely valid.
- Global invalidation is avoided, preserving cache efficiency.
