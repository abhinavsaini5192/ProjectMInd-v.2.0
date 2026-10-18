import type { AnalyticsMetric } from './AnalyticsMetric.js';
import type { AnalyticsScopeRef } from './AnalyticsScope.js';
import type { AnalyticsDataQuality } from './AnalyticsDataQuality.js';
import type { AnalyticsInsight } from './AnalyticsInsight.js';
import type { MetricAggregateResult, TimeWindow } from './AnalyticsSnapshot.js';

export type ReportType =
  | 'OVERVIEW'
  | 'PLATFORM_USAGE'
  | 'REPOSITORY_INTELLIGENCE'
  | 'CONTEXT_EFFECTIVENESS'
  | 'RETRIEVAL_AND_MEMORY'
  | 'AGENT_COLLABORATION'
  | 'TASK_EXECUTION'
  | 'LEARNING_LIFECYCLE'
  | 'PLUGIN_HEALTH'
  | 'RELIABILITY'
  | 'GOVERNANCE';

export interface AnalyticsReport {
  readonly reportId: string;
  readonly type: ReportType;
  readonly title: string;
  readonly scope: AnalyticsScopeRef;
  readonly timeWindow: TimeWindow;
  readonly generatedAt: number;
  readonly metricDefinitions: readonly AnalyticsMetric[];
  readonly results: Record<string, MetricAggregateResult>;
  readonly dataQuality: AnalyticsDataQuality;
  readonly insights: readonly AnalyticsInsight[];
  readonly provenanceReferences: readonly string[];
  readonly metadata?: Record<string, unknown> | undefined;
}
