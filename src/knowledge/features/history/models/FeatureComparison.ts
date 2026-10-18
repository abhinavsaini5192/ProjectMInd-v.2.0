import type { FeatureMilestone } from './FeatureMilestone.js';
import type { FeatureHistoryConfidence } from './FeatureHistoryConfidence.js';

export interface ComparisonTarget {
  type: 'SNAPSHOT' | 'VERSION' | 'TIMESTAMP';
  id: string;
  timestamp: number;
}

export interface MetricDelta {
  before: number;
  after: number;
  delta: number;
}

export interface FeatureComparison {
  featureId: string;
  beforeTarget: ComparisonTarget;
  afterTarget: ComparisonTarget;
  mappingsAdded: string[];
  mappingsRemoved: string[];
  dependenciesAdded: string[];
  dependenciesRemoved: string[];
  flowsAdded: string[];
  flowsRemoved: string[];
  entryPointsAdded: string[];
  entryPointsRemoved: string[];
  healthDelta: MetricDelta;
  riskDelta: MetricDelta;
  criticalityChange: {
    beforeLevel: string;
    afterLevel: string;
  };
  architectureChanges: string[];
  milestonesCrossed: FeatureMilestone[];
  confidence: FeatureHistoryConfidence;
  timestamp: number;
}
