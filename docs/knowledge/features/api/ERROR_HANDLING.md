# Error Handling & Partial Failure Isolation

## Error Hierarchy

All errors in Phase 6.9 inherit from `FeatureKnowledgeError`:

```
FeatureKnowledgeError (base)
  ├── FeatureKnowledgeNotFoundError (feature does not exist in registry)
  ├── FeatureKnowledgeQueryError (malformed query parameters or disallowed stale data)
  ├── FeatureKnowledgeAssemblyError (profile assembly corruption)
  ├── FeatureKnowledgeVersionConflictError (incompatible version requirements)
  └── FeatureKnowledgeAccessError (cross-workspace or cross-repository boundary violation)
```

---

## Partial Provider Failures

A core tenet of the Feature Knowledge API is **partial failure tolerance**:
If a provider repository throws an exception (e.g. database timeout in Behavior Engine), the overall query does **not** fail if core identity is resolved.

Instead:
1. The failing section status is marked `'FAILED'`.
2. The reason is recorded: `reason: err.message`.
3. A structured `FeatureKnowledgeErrorInfo` object is attached:
   ```typescript
   {
     code: 'BEHAVIOR_RETRIEVAL_FAILED',
     message: 'Database connection timeout in BehaviorEngine',
     subsystem: 'FeatureBehaviorEngine',
     details: { section: 'BEHAVIOR', timestamp: 1694900000000 }
   }
   ```
4. The error is aggregated in `response.errors`.
5. Other requested sections (`IDENTITY`, `MAPPINGS`, `HEALTH`, etc.) continue to be returned successfully.
