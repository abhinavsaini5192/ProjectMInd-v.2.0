import type { AnalyticsCategory } from './AnalyticsCategory.js';
import type { AnalyticsScopeRef } from './AnalyticsScope.js';
import type { AnalyticsDataQuality } from './AnalyticsDataQuality.js';
import type { MetricAggregateResult, TimeWindow, TimeWindowType } from './AnalyticsSnapshot.js';

export interface AnalyticsQuery {
  readonly scope: AnalyticsScopeRef;
  readonly timeWindow?: {
    readonly type: TimeWindowType;
    readonly startMs?: number | undefined;
    readonly endMs?: number | undefined;
    readonly timezone?: string | undefined;
  } | undefined;
  readonly metricIds?: readonly string[] | undefined;
  readonly categories?: readonly AnalyticsCategory[] | undefined;
  readonly pagination?: {
    readonly limit?: number | undefined;
    readonly offset?: number | undefined;
  } | undefined;
  readonly includeInsights?: boolean | undefined;
}

export interface AnalyticsQueryResult {
  readonly scope: AnalyticsScopeRef;
  readonly timeWindow: TimeWindow;
  readonly metrics: Record<string, MetricAggregateResult>;
  readonly dataQuality: AnalyticsDataQuality;
  readonly totalRecordsExamined: number;
  readonly executionDurationMs: number;
}

export interface HistoricalComparisonQuery {
  readonly scope: AnalyticsScopeRef;
  readonly baseWindow: TimeWindow;
  readonly compareWindow: TimeWindow;
  readonly metricIds?: readonly string[] | undefined;
  readonly categories?: readonly AnalyticsCategory[] | undefined;
}

export type ComparisonTrend = 'IMPROVED' | 'DEGRADED' | 'UNCHANGED' | 'INSUFFICIENT_DATA';

export interface MetricComparisonItem {
  readonly metricId: string;
  readonly baseValue: number | null;
  readonly compareValue: number | null;
  readonly absoluteDelta: number | null;
  readonly percentageDelta: number | null;
  readonly trend: ComparisonTrend;
}

export interface HistoricalComparisonResult {
  readonly scope: AnalyticsScopeRef;
  readonly baseWindow: TimeWindow;
  readonly compareWindow: TimeWindow;
  readonly comparisons: Record<string, MetricComparisonItem>;
  readonly generatedAt: number;
}
