import type { AnalyticsCategory } from '../models/AnalyticsCategory.js';
import type { AnalyticsMetric } from '../models/AnalyticsMetric.js';

export interface IMetricRegistry {
  registerMetric(metric: AnalyticsMetric): void;
  getMetric(metricId: string): AnalyticsMetric | undefined;
  hasMetric(metricId: string): boolean;
  listMetrics(category?: AnalyticsCategory): readonly AnalyticsMetric[];
}

export const IMetricRegistryToken = Symbol('IMetricRegistry');
