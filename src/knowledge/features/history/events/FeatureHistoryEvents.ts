export const FeatureHistoryEvents = {
  HistoryBuilt: 'feature.history.built',
  TimelineUpdated: 'feature.history.timeline.updated',
  SnapshotCreated: 'feature.history.snapshot.created',
  VersionCreated: 'feature.history.version.created',
  MilestoneDetected: 'feature.history.milestone.detected',
  RegressionDetected: 'feature.history.regression.detected',
  ConflictDetected: 'feature.history.conflict.detected',
  IncrementalUpdated: 'feature.history.incremental.updated',
} as const;

export type FeatureHistoryEventName =
  (typeof FeatureHistoryEvents)[keyof typeof FeatureHistoryEvents];
