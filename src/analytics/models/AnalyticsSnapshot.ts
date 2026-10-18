import type { AnalyticsScopeRef } from './AnalyticsScope.js';
import type { AnalyticsDataQuality } from './AnalyticsDataQuality.js';

export type TimeWindowType = 'SNAPSHOT' | 'LAST_24H' | 'LAST_7D' | 'LAST_30D' | 'CUSTOM';

export interface TimeWindow {
  readonly type: TimeWindowType;
  readonly startMs: number;
  readonly endMs: number;
  readonly timezone: string; // ISO or 'UTC'
}

export type MetricResultStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'NOT_COLLECTED'
  | 'STALE'
  | 'NOT_APPLICABLE';

export interface MetricAggregateResult {
  readonly metricId: string;
  readonly value: number | null;
  readonly status: MetricResultStatus;
  readonly count: number;
  readonly sampleCount: number;
  readonly unit: string;
  readonly definitionVersion: string;
  readonly sourceFreshnessMs?: number | undefined;
}

export interface AnalyticsSnapshot {
  readonly snapshotId: string;
  readonly timestamp: number;
  readonly scope: AnalyticsScopeRef;
  readonly timeWindow: TimeWindow;
  readonly metrics: Record<string, MetricAggregateResult>;
  readonly dataQuality: AnalyticsDataQuality;
  readonly metadata?: Record<string, unknown> | undefined;
}
