# Feature Snapshots & Versioning

## 1. Feature Snapshot Design

A snapshot captures the state of a feature at a discrete point in time without copying full repository trees:

```typescript
export interface FeatureSnapshot {
  snapshotId: string;
  featureId: string;
  timestamp: number;
  version: number;
  metadata: Record<string, any>;
  resourceSummary: ResourceSummary;
  mappingSummary: MappingSummary;
  dependencySummary: DependencySummary;
  behaviorSummary: BehaviorSummary;
  healthSummary: HealthSummary;
  riskSummary: RiskSummary;
  criticalitySummary: CriticalitySummary;
  architectureSummary: ArchitectureSummary;
  status: string;
  confidence: FeatureHistoryConfidence;
  knowledgeVersion: string;
}
```

## 2. Semantic Version Snapshots

Semantic feature versions are resolved by `FeatureVersionResolver` only when significant architectural changes occur:
- Initial feature discovery (v1)
- New entry points or API routes added
- Behavior execution flows added or altered
- Dependency topology shifts
- Status transitions
- Major health/risk score movements ($\ge 20$ points)

Insignificant commits (e.g. documentation typos, style formatting) do NOT increment the feature's semantic version.
