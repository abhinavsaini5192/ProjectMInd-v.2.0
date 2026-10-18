export interface GrowthMetricItem {
  metricName: string;
  currentValue: number;
  previousValue: number;
  delta: number;
  normalizedDelta: number; // e.g. percentage or -1 to 1
  confidence: number;
  timestamp: number;
}

export interface FeatureGrowthMetrics {
  featureId: string;
  timestamp: number;
  metrics: Record<string, GrowthMetricItem>;
}
