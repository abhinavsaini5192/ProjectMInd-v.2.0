# Context Quality Assessment & Pre-delivery Validation

## 1. Quality Dimensions

Context quality is never reduced to an opaque, arbitrary percentage. The [`ContextQualityEvaluator`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextQualityEvaluator.ts) calculates a transparent 7-dimensional assessment:

```typescript
export interface ContextQuality {
  readonly relevance: number;         // Mean composite relevance of selected candidates [0.0 - 1.0]
  readonly completeness: number;      // Feature, resource, and behavior representation [0.0 - 1.0]
  readonly freshness: number;         // Status rating based on underlying knowledge state [0.0 - 1.0]
  readonly confidence: number;        // Grounding confidence of selected evidence [0.0 - 1.0]
  readonly scopeCorrectness: number;   // Verification that all items respect project boundary [0.0 - 1.0]
  readonly tokenEfficiency: number;   // Utilization efficiency within token budget limit [0.0 - 1.0]
  readonly explainability: number;     // Proportion of candidates backed by clear evidence [0.0 - 1.0]
  readonly overallScore: number;      // Weighted composite quality score [0.0 - 1.0]
  readonly assessmentReasons: Record<string, string>;
}
```

## 2. Pre-Delivery Context Validation

The [`ContextValidator`](file:///c:/Users/Mummy/Desktop/bakwas/ProjectMind/src/context/intelligence/ContextValidator.ts) performs mandatory checks before returning any package:

1. **Workspace Boundary**: Rejects cross-workspace contamination (`ScopeViolationError`).
2. **Project Boundary**: Rejects unauthorized access across project partitions (`ScopeViolationError`).
3. **Budget Cap**: Fails if total tokens exceed configured budget $+ 10\%$ tolerance (`ContextValidationError`).
4. **Duplicate Filtering**: Identifies duplicate resources and attaches deduplication warnings.
5. **Freshness Verification**: Warns if context is generated from stale or invalid knowledge versions.
