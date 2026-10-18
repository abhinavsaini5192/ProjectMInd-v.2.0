# Completeness vs. Confidence Models

## Fundamental Distinction

Completeness and Confidence answer fundamentally different questions:
- **Completeness**: *"How much of the expected knowledge has actually been discovered and assembled?"*
- **Confidence**: *"How trustworthy and verified is the evidence backing the available knowledge?"*

Example:
- A newly discovered feature may have **100% confidence** in its single AST endpoint mapping, but **Minimal Completeness** because behavior, health, impact, and history have not yet been analyzed.
- A feature may have **100% Completeness** (all sections computed) but **Medium Confidence** if its dependencies were inferred heuristically rather than verified statically.

---

## Completeness Model

```typescript
export interface FeatureKnowledgeCompleteness {
  requestedSections: FeatureKnowledgeSection[];
  availableSections: FeatureKnowledgeSection[];
  unavailableSections: FeatureKnowledgeSection[];
  staleSections: FeatureKnowledgeSection[];
  failedSections: FeatureKnowledgeSection[];
  notComputedSections: FeatureKnowledgeSection[];
  completenessRatio: number; // 0.0 to 1.0
  status: CompletenessStatus;
  missingKnowledgeReasons: Record<string, string>;
}
```

### Thresholds
- `COMPLETE`: `completenessRatio === 1.0` (all requested sections available).
- `MOSTLY_COMPLETE`: `completenessRatio >= 0.75`.
- `PARTIAL`: `completenessRatio >= 0.40`.
- `MINIMAL`: `completenessRatio > 0.0`.
- `UNKNOWN`: `completenessRatio === 0.0`.

---

## Confidence Model

```typescript
export interface FeatureKnowledgeConfidence {
  overallScore: number; // 0.0 to 1.0
  level: KnowledgeConfidenceLevel; // 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW'
  sectionConfidences: Record<string, number>;
  factors: string[];
  limitations: string[];
}
```

### Rules
1. **Never use a naive average**: Sections with no evidence or missing analysis do not artificially inflate confidence.
2. **Stale Data Discount**: Stale sections receive a 30% confidence penalty (`conf * 0.7`) and are recorded in `limitations`.
3. **Explicit Subsystem Attributions**: Tracked in `factors`, explaining exact evidence sources.
