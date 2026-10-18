import type { FeatureTrendType } from './FeatureTrendType.js';
import type { FeatureHistoryConfidence } from './FeatureHistoryConfidence.js';

export type TrendDirection = 'UP' | 'DOWN' | 'STABLE' | 'NEUTRAL';

export interface FeatureTrend {
  trendType: FeatureTrendType;
  direction: TrendDirection;
  description: string;
  confidence: FeatureHistoryConfidence;
  evidence: string[];
  observationCount: number;
  metricsInvolved: string[];
}
