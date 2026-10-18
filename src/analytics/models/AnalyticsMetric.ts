import type { AnalyticsCategory } from './AnalyticsCategory.js';
import type { AnalyticsScopeType } from './AnalyticsScope.js';

export type MetricValueType = 'NUMBER' | 'PERCENTAGE' | 'DURATION_MS' | 'BYTES' | 'RATIO';

export type AggregationMethod =
  | 'SUM'
  | 'AVG'
  | 'COUNT'
  | 'LATEST'
  | 'P50'
  | 'P90'
  | 'P95'
  | 'P99'
  | 'MIN'
  | 'MAX'
  | 'RATIO';

export type PrivacyClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';

export interface AnalyticsMetric {
  readonly metricId: string;
  readonly name: string;
  readonly description: string;
  readonly category: AnalyticsCategory;
  readonly valueType: MetricValueType;
  readonly unit: string;
  readonly definitionVersion: string;
  readonly supportedScopes: readonly AnalyticsScopeType[];
  readonly authoritativeSource: string;
  readonly aggregationMethod: AggregationMethod;
  readonly freshnessSeconds: number;
  readonly privacyClassification: PrivacyClassification;
  readonly numeratorMetricId?: string | undefined;
  readonly denominatorMetricId?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
