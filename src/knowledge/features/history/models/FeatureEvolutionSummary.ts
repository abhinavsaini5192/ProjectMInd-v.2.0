import type { FeatureMilestone } from './FeatureMilestone.js';
import type { FeatureTrend } from './FeatureTrend.js';
import type { FeatureMaturity } from './FeatureMaturity.js';
import type { FeatureHistoryConfidence } from './FeatureHistoryConfidence.js';

export interface FeatureEvolutionSummary {
  featureId: string;
  featureName: string;
  firstSeenAt: number;
  lastUpdatedAt: number;
  currentMaturity: FeatureMaturity;
  majorMilestones: FeatureMilestone[];
  currentTrends: FeatureTrend[];
  historicalRisks: string[];
  overallConfidence: FeatureHistoryConfidence;
  textSummary: string;
}
