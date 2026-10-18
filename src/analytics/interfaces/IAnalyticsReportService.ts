import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';
import type { TimeWindow } from '../models/AnalyticsSnapshot.js';
import type { AnalyticsReport, ReportType } from '../models/AnalyticsReport.js';

export interface IAnalyticsReportService {
  generateReport(
    scope: AnalyticsScopeRef,
    type: ReportType,
    window: TimeWindow
  ): Promise<AnalyticsReport>;
  getReport(reportId: string): Promise<AnalyticsReport | undefined>;
  listReports(scope: AnalyticsScopeRef, limit?: number): Promise<readonly AnalyticsReport[]>;
}

export const IAnalyticsReportServiceToken = Symbol('IAnalyticsReportService');
