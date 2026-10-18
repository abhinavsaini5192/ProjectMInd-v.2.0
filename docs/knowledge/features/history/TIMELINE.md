# Feature Timeline Architecture

## 1. Structure

`FeatureTimeline` represents an immutable, chronologically ordered sequence of raw history events, aggregated evolution episodes, and milestones:

```typescript
export interface FeatureTimeline {
  featureId: string;
  events: FeatureHistoryEvent[];
  evolutionEvents: FeatureEvolutionEvent[];
  milestones: FeatureMilestone[];
  startTime: number;
  endTime: number;
  eventCount: number;
  meaningfulEventCount: number;
  confidence: FeatureHistoryConfidence;
  timelineVersion: number;
}
```

## 2. Deterministic Ordering

Events are ordered deterministically:
1. `knowledgeVersion` (if provided)
2. `timestamp`
3. Priority index (e.g. `FEATURE_CREATED` > `FEATURE_MAPPING_ADDED` > `TECHNICAL_CHANGE`)
4. Event ID string comparison

## 3. Meaningful vs Technical Event Counts

Technical changes (e.g. formatting-only commits, lint updates) are preserved in `events` for complete auditability, but are excluded from `meaningfulEventCount` and are flagged with `isSemantic: false`.
