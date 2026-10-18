# Feature History API Reference

## 1. Engine & API Methods

The `FeatureHistoryAPI` and `FeatureHistoryEngine` provide the following interface:

### Build & Update
- `buildHistory(featureId: string, options?: BuildHistoryOptions): Promise<FeatureHistory>`
- `buildHistories(featureIds: string[], options?: BuildHistoryOptions): Promise<FeatureHistory[]>`
- `rebuildHistory(featureId: string, options?: BuildHistoryOptions): Promise<FeatureHistory>`
- `updateIncremental(events: FeatureHistoryEvent[], options?: BuildHistoryOptions): Promise<FeatureHistory[]>`

### History Queries
- `getHistory(featureId: string): Promise<FeatureHistory | null>`
- `getTimeline(featureId: string): Promise<FeatureTimeline | null>`
- `getEvents(featureId: string): Promise<FeatureHistoryEvent[]>`
- `getEvent(featureId: string, eventId: string): Promise<FeatureHistoryEvent | null>`
- `getSnapshots(featureId: string): Promise<FeatureSnapshot[]>`
- `getSnapshot(featureId: string, snapshotId: string): Promise<FeatureSnapshot | null>`
- `getMilestones(featureId: string): Promise<FeatureMilestone[]>`
- `getTrends(featureId: string): Promise<FeatureTrend[]>`
- `getGrowthMetrics(featureId: string): Promise<FeatureGrowthMetrics | null>`
- `getMaturity(featureId: string): Promise<FeatureMaturity | null>`
- `getRegressions(featureId: string): Promise<FeatureRegression[]>`

### Comparisons & Explanations
- `compareSnapshots(featureId: string, beforeId: string, afterId: string): Promise<FeatureComparison>`
- `compareVersions(featureId: string, beforeVersion: number, afterVersion: number): Promise<FeatureComparison>`
- `compareAtTimestamps(featureId: string, before: number, after: number): Promise<FeatureComparison>`
- `explainEvolution(featureId: string): Promise<FeatureEvolutionSummary>`
- `getHistoryConflicts(featureId: string): Promise<FeatureHistoryConflict[]>`
- `getHistoryRun(runId: string): Promise<FeatureHistory | null>`
