# Feature History Model

## 1. Schema & Fields

`FeatureHistory` is the canonical domain model representing the complete historical state and trajectory of a feature.

```typescript
export interface FeatureHistory {
  historyId: string;
  featureId: string;
  workspaceId: string;
  repositoryId: string;
  firstSeenAt: number;
  lastUpdatedAt: number;
  currentVersion: number;
  timeline: FeatureTimeline;
  snapshots: FeatureSnapshot[];
  evolutionEvents: FeatureEvolutionEvent[];
  milestones: FeatureMilestone[];
  trends: FeatureTrend[];
  growthMetrics: FeatureGrowthMetrics;
  maturity: FeatureMaturity;
  regressions: FeatureRegression[];
  currentState: FeatureSnapshot;
  confidence: FeatureHistoryConfidence;
  knowledgeVersion: string;
  historyVersion: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}
```

## 2. Identity & Stability

- **Stable Identity**: Feature identity is always established by a permanent `featureId` (e.g. `feat_auth_login`), never volatile paths or transient display labels.
- **Repository & Workspace Isolation**: Histories are strictly scoped by `workspaceId` and `repositoryId`.
- **Bounded Retention**: Snapshots retain compact summaries rather than full raw AST graphs.
