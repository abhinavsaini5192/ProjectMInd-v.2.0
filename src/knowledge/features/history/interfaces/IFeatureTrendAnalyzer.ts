import type { FeatureSnapshot } from '../models/FeatureSnapshot.js';
import type { FeatureTimeline } from '../models/FeatureTimeline.js';
import type { FeatureTrend } from '../models/FeatureTrend.js';
import type { FeatureGrowthMetrics } from '../models/FeatureGrowthMetrics.js';
import type { FeatureMaturity } from '../models/FeatureMaturity.js';
import type { FeatureRegression } from '../models/FeatureRegression.js';

export interface IFeatureTrendAnalyzer {
  analyzeTrends(
    featureId: string,
    snapshots: FeatureSnapshot[],
    timeline: FeatureTimeline
  ): FeatureTrend[];

  calculateGrowthMetrics(
    featureId: string,
    snapshots: FeatureSnapshot[]
  ): FeatureGrowthMetrics;

  determineMaturity(
    featureId: string,
    snapshots: FeatureSnapshot[],
    trends: FeatureTrend[]
  ): FeatureMaturity;

  detectRegressions(
    featureId: string,
    snapshots: FeatureSnapshot[]
  ): FeatureRegression[];
}
