# Feature Knowledge Query Model

## Model Specification

```typescript
export interface FeatureKnowledgeQuery {
  featureId: string;
  workspaceId?: string | undefined;
  repositoryId?: string | undefined;
  sections?: FeatureKnowledgeSection[] | undefined;
  includeDependencies?: boolean | undefined;
  includeDependents?: boolean | undefined;
  includeBehavior?: boolean | undefined;
  includeHealth?: boolean | undefined;
  includeImpact?: boolean | undefined;
  includeHistory?: boolean | undefined;
  includeArchitecture?: boolean | undefined;
  includeSummary?: boolean | undefined;
  includeExplanations?: boolean | undefined;
  includeReferences?: boolean | undefined;
  includeContextPackage?: boolean | undefined;
  maxDepth?: number | undefined;
  maxItemsPerSection?: number | undefined;
  tokenBudget?: number | undefined;
  freshness?: 'CURRENT' | 'ALLOW_STALE' | 'ANY' | undefined;
  knowledgeVersion?: string | undefined;
  includeInactive?: boolean | undefined;
  includeLowConfidence?: boolean | undefined;
  explainSelection?: boolean | undefined;
  compactMode?: boolean | undefined;
  requestId?: string | undefined;
}
```

---

## Field Semantics & Constraints

| Field | Type | Description | Default |
|---|---|---|---|
| `featureId` | `string` | Unique identifier of target feature. Required. | — |
| `workspaceId` | `string` | Scope boundary check. Throws `FeatureKnowledgeAccessError` on mismatch. | optional |
| `repositoryId` | `string` | Scope boundary check. Throws `FeatureKnowledgeAccessError` on mismatch. | optional |
| `sections` | `FeatureKnowledgeSection[]` | List of explicit sections to retrieve. | All sections |
| `freshness` | `'CURRENT' \| 'ALLOW_STALE' \| 'ANY'` | Freshness requirement. 'CURRENT' rejects stale data. | `'CURRENT'` |
| `knowledgeVersion` | `string` | Requested knowledge snapshot version. | latest |
| `tokenBudget` | `number` | Upper bound for context package generation. | unlimited |
| `maxItemsPerSection`| `number` | Limit on items in collections (mappings, flows, etc.). | unlimited |

---

## Query Validation

`FeatureKnowledgeValidator.validate(query)` guarantees:
- `featureId` is non-empty and non-whitespace.
- All elements of `sections` belong to `FEATURE_KNOWLEDGE_SECTIONS`.
- `maxDepth >= 0` and is an integer.
- `tokenBudget > 0` and `maxItemsPerSection > 0`.
- Freshness matches allowed enum values.
