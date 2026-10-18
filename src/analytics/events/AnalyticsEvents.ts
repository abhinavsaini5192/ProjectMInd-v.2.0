import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';
import type { TimeWindow } from '../models/AnalyticsSnapshot.js';

export const ANALYTICS_EVENT_NAMES = {
  METRIC_REGISTERED: 'Analytics.MetricRegistered',
  RECORD_INGESTED: 'Analytics.RecordIngested',
  SNAPSHOT_GENERATED: 'Analytics.SnapshotGenerated',
  REPORT_GENERATED: 'Analytics.ReportGenerated',
  DATA_QUALITY_DEGRADED: 'Analytics.DataQualityDegraded',
  MAINTENANCE_EXECUTED: 'Analytics.MaintenanceExecuted',
} as const;

export interface AnalyticsMetricRegisteredPayload {
  readonly metricId: string;
  readonly category: string;
  readonly version: string;
  readonly registeredAt: number;
}

export interface AnalyticsRecordIngestedPayload {
  readonly recordId: string;
  readonly metricId: string;
  readonly scope: AnalyticsScopeRef;
  readonly timestamp: number;
}

export interface AnalyticsSnapshotGeneratedPayload {
  readonly snapshotId: string;
  readonly scope: AnalyticsScopeRef;
  readonly timeWindow: TimeWindow;
  readonly metricCount: number;
  readonly generatedAt: number;
}

export interface AnalyticsReportGeneratedPayload {
  readonly reportId: string;
  readonly reportType: string;
  readonly scope: AnalyticsScopeRef;
  readonly timeWindow: TimeWindow;
  readonly generatedAt: number;
}

export interface AnalyticsDataQualityDegradedPayload {
  readonly scope: AnalyticsScopeRef;
  readonly status: string;
  readonly warnings: readonly string[];
  readonly missingMetrics: readonly string[];
  readonly evaluatedAt: number;
}

export interface AnalyticsMaintenanceExecutedPayload {
  readonly recordsPruned: number;
  readonly snapshotsRetained: number;
  readonly durationMs: number;
  readonly executedAt: number;
}
