import type { FeatureTimeline } from './FeatureTimeline.js';
import type { FeatureSnapshot } from './FeatureSnapshot.js';
import type { FeatureEvolutionEvent } from './FeatureEvolutionEvent.js';
import type { FeatureMilestone } from './FeatureMilestone.js';
import type { FeatureTrend } from './FeatureTrend.js';
import type { FeatureGrowthMetrics } from './FeatureGrowthMetrics.js';
import type { FeatureMaturity } from './FeatureMaturity.js';
import type { FeatureRegression } from './FeatureRegression.js';
import type { FeatureHistoryConfidence } from './FeatureHistoryConfidence.js';

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
