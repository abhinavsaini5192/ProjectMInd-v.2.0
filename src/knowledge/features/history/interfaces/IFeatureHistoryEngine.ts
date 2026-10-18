import type { FeatureHistory } from '../models/FeatureHistory.js';
import type { FeatureTimeline } from '../models/FeatureTimeline.js';
import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureMilestone } from '../models/FeatureMilestone.js';
import type { FeatureTrend } from '../models/FeatureTrend.js';
import type { FeatureGrowthMetrics } from '../models/FeatureGrowthMetrics.js';
import type { FeatureMaturity } from '../models/FeatureMaturity.js';
import type { FeatureRegression } from '../models/FeatureRegression.js';
import type { FeatureComparison } from '../models/FeatureComparison.js';
import type { FeatureEvolutionSummary } from '../models/FeatureEvolutionSummary.js';
import type { FeatureHistoryConflict } from '../models/FeatureHistoryConflict.js';

export interface BuildHistoryOptions {
  workspaceId?: string | undefined;
  repositoryId?: string | undefined;
  forceRebuild?: boolean | undefined;
  knowledgeVersion?: string | undefined;
  analysisMode?: 'FULL' | 'INCREMENTAL' | 'REBUILD' | undefined;
}

export interface IFeatureHistoryEngine {
  buildHistory(featureId: string, options?: BuildHistoryOptions): Promise<FeatureHistory>;
  buildHistories(featureIds: string[], options?: BuildHistoryOptions): Promise<FeatureHistory[]>;
  rebuildHistory(featureId: string, options?: BuildHistoryOptions): Promise<FeatureHistory>;
  updateIncremental(events: FeatureHistoryEvent[], options?: BuildHistoryOptions): Promise<FeatureHistory[]>;
  getHistory(featureId: string): Promise<FeatureHistory | null>;
  getTimeline(featureId: string): Promise<FeatureTimeline | null>;
  getEvents(featureId: string): Promise<FeatureHistoryEvent[]>;
  getEvent(featureId: string, eventId: string): Promise<FeatureHistoryEvent | null>;
  getSnapshots(featureId: string): Promise<FeatureSnapshot[]>;
  getSnapshot(featureId: string, snapshotId: string): Promise<FeatureSnapshot | null>;
  getMilestones(featureId: string): Promise<FeatureMilestone[]>;
  getTrends(featureId: string): Promise<FeatureTrend[]>;
  getGrowthMetrics(featureId: string): Promise<FeatureGrowthMetrics | null>;
  getMaturity(featureId: string): Promise<FeatureMaturity | null>;
  getRegressions(featureId: string): Promise<FeatureRegression[]>;
  compareSnapshots(featureId: string, beforeId: string, afterId: string): Promise<FeatureComparison>;
  compareVersions(featureId: string, beforeVersion: number, afterVersion: number): Promise<FeatureComparison>;
  compareAtTimestamps(featureId: string, before: number, after: number): Promise<FeatureComparison>;
  explainEvolution(featureId: string): Promise<FeatureEvolutionSummary>;
  getHistoryConflicts(featureId: string): Promise<FeatureHistoryConflict[]>;
}
