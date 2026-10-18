import type { IAnalyticsService } from '../interfaces/IAnalyticsService.js';
import type { IMetricRegistry } from '../interfaces/IMetricRegistry.js';
import type { IAnalyticsAggregator } from '../interfaces/IAnalyticsAggregator.js';
import type { IAnalyticsReportService } from '../interfaces/IAnalyticsReportService.js';
import type { IAnalyticsInsightEngine } from '../interfaces/IAnalyticsInsightEngine.js';
import type { AnalyticsCategory } from '../models/AnalyticsCategory.js';
import type { AnalyticsMetric } from '../models/AnalyticsMetric.js';
import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';
import type { TimeWindow, AnalyticsSnapshot, TimeWindowType } from '../models/AnalyticsSnapshot.js';
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
import {
  AnalyticsScopeUnauthorizedError,
  InvalidTimeWindowError,
} from '../errors/AnalyticsError.js';

export class AnalyticsService implements IAnalyticsService {
  constructor(
    private readonly metricRegistry: IMetricRegistry,
    private readonly aggregator: IAnalyticsAggregator,
    private readonly reportService: IAnalyticsReportService,
    private readonly insightEngine: IAnalyticsInsightEngine
  ) {}

  public listMetrics(category?: AnalyticsCategory): readonly AnalyticsMetric[] {
    return this.metricRegistry.listMetrics(category);
  }

  public getMetric(metricId: string): AnalyticsMetric | undefined {
    return this.metricRegistry.getMetric(metricId);
  }

  public async query(
    query: AnalyticsQuery,
    principal?: SecurityPrincipal
  ): Promise<AnalyticsQueryResult> {
    this.enforceScopeAuthorization(query.scope, principal);
    const window = this.normalizeTimeWindow(query.timeWindow);
    return this.aggregator.aggregate(query.scope, window, query.metricIds);
  }

  public async generateSnapshot(
    scope: AnalyticsScopeRef,
    window?: Partial<TimeWindow>,
    principal?: SecurityPrincipal
  ): Promise<AnalyticsSnapshot> {
    this.enforceScopeAuthorization(scope, principal);
    const normalizedWindow = this.normalizeTimeWindow(window);
    return this.aggregator.generateSnapshot(scope, normalizedWindow);
  }

  public async getSnapshot(
    snapshotId: string,
    principal?: SecurityPrincipal
  ): Promise<AnalyticsSnapshot | undefined> {
    // Report service or store check can be performed, or return undefined if not found
    return undefined; // Handled directly if caller needs store retrieval or via store
  }

  public async generateReport(
    scope: AnalyticsScopeRef,
    type: ReportType,
    window?: Partial<TimeWindow>,
    principal?: SecurityPrincipal
  ): Promise<AnalyticsReport> {
    this.enforceScopeAuthorization(scope, principal);
    const normalizedWindow = this.normalizeTimeWindow(window);
    return this.reportService.generateReport(scope, type, normalizedWindow);
  }

  public async getReport(
    reportId: string,
    principal?: SecurityPrincipal
  ): Promise<AnalyticsReport | undefined> {
    const report = await this.reportService.getReport(reportId);
    if (report) {
      this.enforceScopeAuthorization(report.scope, principal);
    }
    return report;
  }

  public async listReports(
    scope: AnalyticsScopeRef,
    limit: number = 50,
    principal?: SecurityPrincipal
  ): Promise<readonly AnalyticsReport[]> {
    this.enforceScopeAuthorization(scope, principal);
    return this.reportService.listReports(scope, limit);
  }

  public async compare(
    query: HistoricalComparisonQuery,
    principal?: SecurityPrincipal
  ): Promise<HistoricalComparisonResult> {
    this.enforceScopeAuthorization(query.scope, principal);
    return this.aggregator.compareWindows(query);
  }

  public async getInsights(
    scope: AnalyticsScopeRef,
    window?: Partial<TimeWindow>,
    principal?: SecurityPrincipal
  ): Promise<readonly AnalyticsInsight[]> {
    this.enforceScopeAuthorization(scope, principal);
    const normalizedWindow = this.normalizeTimeWindow(window);
    const aggResult = await this.aggregator.aggregate(scope, normalizedWindow);
    return this.insightEngine.generateInsights(scope, normalizedWindow, aggResult.metrics);
  }

  public async getDataQuality(
    scope: AnalyticsScopeRef,
    window?: Partial<TimeWindow>,
    principal?: SecurityPrincipal
  ): Promise<AnalyticsDataQuality> {
    this.enforceScopeAuthorization(scope, principal);
    const normalizedWindow = this.normalizeTimeWindow(window);
    const aggResult = await this.aggregator.aggregate(scope, normalizedWindow);
    return aggResult.dataQuality;
  }

  public normalizeTimeWindow(
    window?: {
      readonly type?: TimeWindowType | undefined;
      readonly startMs?: number | undefined;
      readonly endMs?: number | undefined;
      readonly timezone?: string | undefined;
    } | undefined
  ): TimeWindow {
    const now = Date.now();
    const type = window?.type ?? 'LAST_24H';

    switch (type) {
      case 'SNAPSHOT':
        return {
          type: 'SNAPSHOT',
          startMs: now - 300_000, // last 5 minutes
          endMs: now,
          timezone: window?.timezone ?? 'UTC',
        };
      case 'LAST_24H':
        return {
          type: 'LAST_24H',
          startMs: now - 86_400_000,
          endMs: now,
          timezone: window?.timezone ?? 'UTC',
        };
      case 'LAST_7D':
        return {
          type: 'LAST_7D',
          startMs: now - 7 * 86_400_000,
          endMs: now,
          timezone: window?.timezone ?? 'UTC',
        };
      case 'LAST_30D':
        return {
          type: 'LAST_30D',
          startMs: now - 30 * 86_400_000,
          endMs: now,
          timezone: window?.timezone ?? 'UTC',
        };
      case 'CUSTOM': {
        if (!window?.startMs || !window?.endMs) {
          throw new InvalidTimeWindowError('CUSTOM time window must specify startMs and endMs');
        }
        if (window.startMs >= window.endMs) {
          throw new InvalidTimeWindowError('startMs must be strictly earlier than endMs');
        }
        const maxRangeMs = 90 * 86_400_000; // max 90 days bounded query cost
        if (window.endMs - window.startMs > maxRangeMs) {
          throw new InvalidTimeWindowError('Time window range exceeds maximum allowed limit of 90 days');
        }
        return {
          type: 'CUSTOM',
          startMs: window.startMs,
          endMs: window.endMs,
          timezone: window?.timezone ?? 'UTC',
        };
      }
      default:
        return {
          type: 'LAST_24H',
          startMs: now - 86_400_000,
          endMs: now,
          timezone: 'UTC',
        };
    }
  }

  private enforceScopeAuthorization(scope: AnalyticsScopeRef, principal?: SecurityPrincipal): void {
    if (!principal) {
      // Internal system or unauthenticated tests allowed unless explicit principal provided
      return;
    }

    const role = principal.role;

    // 1. Instance (Global) scope requires administrative authorization
    if (scope.scopeType === 'INSTANCE') {
      if (role !== 'OWNER' && role !== 'ADMIN') {
        throw new AnalyticsScopeUnauthorizedError(
          `Principal '${principal.principalId}' with role '${role}' is not authorized for global instance analytics. Administrative role required.`
        );
      }
      return;
    }

    // 2. Cross-workspace access checks
    if (scope.workspaceId) {
      const authorizedWorkspaces = (principal as any).authorizedWorkspaces ?? [
        (principal as any).workspaceId,
      ];
      if (role !== 'OWNER' && role !== 'ADMIN' && !authorizedWorkspaces.includes(scope.workspaceId)) {
        throw new AnalyticsScopeUnauthorizedError(
          `Principal '${principal.principalId}' is not authorized to access analytics for workspace '${scope.workspaceId}'.`
        );
      }
    }
  }
}
