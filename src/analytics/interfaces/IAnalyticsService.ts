import type { AnalyticsCategory } from '../models/AnalyticsCategory.js';
import type { AnalyticsMetric } from '../models/AnalyticsMetric.js';
import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';
import type { TimeWindow, AnalyticsSnapshot } from '../models/AnalyticsSnapshot.js';
import type { AnalyticsDataQuality } from '../models/AnalyticsDataQuality.js';
import type { AnalyticsInsight } from '../models/AnalyticsInsight.js';
import type { AnalyticsReport, ReportType } from '../models/AnalyticsReport.js';
import type {
  AnalyticsQuery,
  AnalyticsQueryResult,
  HistoricalComparisonQuery,
  HistoricalComparisonResult,
} from '../models/AnalyticsQuery.js';
import type { SecurityPrincipal } from '../../security/models/SecurityPrincipal.js';

export interface IAnalyticsService {
  listMetrics(category?: AnalyticsCategory): readonly AnalyticsMetric[];
  getMetric(metricId: string): AnalyticsMetric | undefined;

  query(query: AnalyticsQuery, principal?: SecurityPrincipal): Promise<AnalyticsQueryResult>;
  generateSnapshot(
    scope: AnalyticsScopeRef,
    window?: Partial<TimeWindow>,
    principal?: SecurityPrincipal
  ): Promise<AnalyticsSnapshot>;
  getSnapshot(snapshotId: string, principal?: SecurityPrincipal): Promise<AnalyticsSnapshot | undefined>;

  generateReport(
    scope: AnalyticsScopeRef,
    type: ReportType,
    window?: Partial<TimeWindow>,
    principal?: SecurityPrincipal
  ): Promise<AnalyticsReport>;
  getReport(reportId: string, principal?: SecurityPrincipal): Promise<AnalyticsReport | undefined>;
  listReports(
    scope: AnalyticsScopeRef,
    limit?: number,
    principal?: SecurityPrincipal
  ): Promise<readonly AnalyticsReport[]>;

  compare(
    query: HistoricalComparisonQuery,
    principal?: SecurityPrincipal
  ): Promise<HistoricalComparisonResult>;

  getInsights(
    scope: AnalyticsScopeRef,
    window?: Partial<TimeWindow>,
    principal?: SecurityPrincipal
  ): Promise<readonly AnalyticsInsight[]>;

  getDataQuality(
    scope: AnalyticsScopeRef,
    window?: Partial<TimeWindow>,
    principal?: SecurityPrincipal
  ): Promise<AnalyticsDataQuality>;
}

export const IAnalyticsServiceToken = Symbol('IAnalyticsService');
