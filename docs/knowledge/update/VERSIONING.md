# Knowledge Versioning & Monotonicity

## Version Model

Every material change to ProjectMind's persistent repository knowledge produces a strictly monotonic, immutable `KnowledgeVersion` record:

```typescript
export interface KnowledgeVersion {
  readonly versionId: string; // e.g. "K1", "K2", ...
  readonly versionNumber: number; // 1, 2, 3, ...
  readonly repositoryId: string;
  readonly workspaceId?: string | undefined;
  readonly parentVersionId?: string | undefined; // points to previous active version
  readonly createdAt: number;
  readonly sourceUpdateIds: readonly string[]; // updates that formed this version
  readonly affectedKnowledgeAreas: readonly KnowledgeArea[];
  readonly affectedResources: readonly string[];
  readonly affectedFeatures: readonly string[];
  readonly status: 'ACTIVE' | 'SUPERSEDED' | 'ROLLED_BACK';
  readonly completeness: 'COMPLETE' | 'PARTIAL';
  readonly confidence: number;
  readonly metadata: Record<string, unknown>;
}
```

## Version Advancement Predicate

Versions are not incremented for trivial no-ops. `shouldIncrementVersion(...)` evaluates:

1. **Applied Areas Non-Empty**: At least one knowledge area successfully updated (`appliedAreas.length > 0`).
2. **Resource or Feature Targets Non-Empty**: Targets must have at least one modified resource or feature.
3. **Canonical Knowledge Area Match**: At least one applied area must belong to canonical persistent intelligence:
   - `FEATURE_MAPPING`
   - `FEATURE_DEPENDENCIES`
   - `FEATURE_BEHAVIOR`
   - `FEATURE_HEALTH`
   - `FEATURE_RISK`
   - `FEATURE_IMPACT`
   - `FEATURE_HISTORY`
   - `RESOURCE_METADATA`
   - `SYMBOL_KNOWLEDGE`
   - `VERIFICATION`
   - `API_KNOWLEDGE`

## Lineage and Parent Pointers

Every new version stores `parentVersionId` pointing to the previous latest version for that `repositoryId`. This guarantees:
- Full auditability of knowledge evolution over time.
- Ability to compute precise deltas between arbitrary versions ($K_i \rightarrow K_j$).
- Non-destructive updates: historical versions are preserved indefinitely.
