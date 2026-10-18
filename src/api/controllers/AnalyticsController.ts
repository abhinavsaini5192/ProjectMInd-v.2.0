import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IAnalyticsService } from '../../analytics/interfaces/IAnalyticsService.js';
import { ApiError } from '../errors/ApiError.js';
import {
  MetricNotFoundError,
  InvalidMetricDefinitionError,
  InvalidTimeWindowError,
  AnalyticsScopeUnauthorizedError,
  ReportNotFoundError,
} from '../../analytics/errors/AnalyticsError.js';
import type { AnalyticsCategory } from '../../analytics/models/AnalyticsCategory.js';
import type { AnalyticsScopeRef } from '../../analytics/models/AnalyticsScope.js';
import type { ReportType } from '../../analytics/models/AnalyticsReport.js';

export class AnalyticsController extends BaseApiController {
  constructor(private readonly analyticsService: IAnalyticsService) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    router.get('/analytics/metrics', this.handleListMetrics.bind(this));
    router.get('/analytics/metrics/:metricId', this.handleGetMetric.bind(this));

    router.post('/analytics/query', this.handleQuery.bind(this));
    router.post('/analytics/snapshots', this.handleGenerateSnapshot.bind(this));
    router.get('/analytics/snapshots/:snapshotId', this.handleGetSnapshot.bind(this));

    router.post('/analytics/reports', this.handleGenerateReport.bind(this));
    router.get('/analytics/reports', this.handleListReports.bind(this));
    router.get('/analytics/reports/:reportId', this.handleGetReport.bind(this));

    router.post('/analytics/compare', this.handleCompare.bind(this));
    router.get('/analytics/insights', this.handleGetInsights.bind(this));
    router.get('/analytics/quality', this.handleGetDataQuality.bind(this));
  }

  private async handleListMetrics(request: ApiRequest): Promise<ApiResponse<any>> {
    const category = request.query?.category as AnalyticsCategory | undefined;
    const metrics = this.analyticsService.listMetrics(category);
    return this.ok(request, { metrics, count: metrics.length });
  }

  private async handleGetMetric(request: ApiRequest): Promise<ApiResponse<any>> {
    const metricId = request.params?.metricId;
    if (!metricId) {
      throw ApiError.badRequest('Missing metricId parameter');
    }
    const metric = this.analyticsService.getMetric(metricId);
    if (!metric) {
      throw ApiError.notFound(`Metric not found: '${metricId}'`);
    }
    return this.ok(request, metric);
  }

  private async handleQuery(request: ApiRequest): Promise<ApiResponse<any>> {
    try {
      const body = (request.body as Record<string, any>) ?? {};
      const scope = this.extractScope(body.scope ?? request.query);
      const result = await this.analyticsService.query(
        {
          scope,
          timeWindow: body.timeWindow,
          metricIds: body.metricIds,
          categories: body.categories,
          pagination: body.pagination,
          includeInsights: body.includeInsights,
        },
        request.context.securityPrincipal as any
      );
      return this.ok(request, result);
    } catch (err: any) {
      this.translateError(err);
    }
  }

  private async handleGenerateSnapshot(request: ApiRequest): Promise<ApiResponse<any>> {
    try {
      const body = (request.body as Record<string, any>) ?? {};
      const scope = this.extractScope(body.scope ?? request.query);
      const snapshot = await this.analyticsService.generateSnapshot(
        scope,
        body.timeWindow,
        request.context.securityPrincipal as any
      );
      return this.created(request, snapshot);
    } catch (err: any) {
      this.translateError(err);
    }
  }

  private async handleGetSnapshot(request: ApiRequest): Promise<ApiResponse<any>> {
    try {
      const snapshotId = request.params?.snapshotId;
      if (!snapshotId) {
        throw ApiError.badRequest('Missing snapshotId parameter');
      }
      const snapshot = await this.analyticsService.getSnapshot(
        snapshotId,
        request.context.securityPrincipal as any
      );
      if (!snapshot) {
        throw ApiError.notFound(`Snapshot not found: '${snapshotId}'`);
      }
      return this.ok(request, snapshot);
    } catch (err: any) {
      this.translateError(err);
    }
  }

  private async handleGenerateReport(request: ApiRequest): Promise<ApiResponse<any>> {
    try {
      const body = (request.body as Record<string, any>) ?? {};
      const scope = this.extractScope(body.scope ?? request.query);
      const type: ReportType = body.type ?? 'OVERVIEW';
      const report = await this.analyticsService.generateReport(
        scope,
        type,
        body.timeWindow,
        request.context.securityPrincipal as any
      );
      return this.created(request, report);
    } catch (err: any) {
      this.translateError(err);
    }
  }

  private async handleListReports(request: ApiRequest): Promise<ApiResponse<any>> {
    try {
      const scope = this.extractScope(request.query);
      const limit = request.query?.limit ? parseInt(request.query.limit as string, 10) : 50;
      const reports = await this.analyticsService.listReports(
        scope,
        limit,
        request.context.securityPrincipal as any
      );
      return this.ok(request, { reports, count: reports.length });
    } catch (err: any) {
      this.translateError(err);
    }
  }

  private async handleGetReport(request: ApiRequest): Promise<ApiResponse<any>> {
    try {
      const reportId = request.params?.reportId;
      if (!reportId) {
        throw ApiError.badRequest('Missing reportId parameter');
      }
      const report = await this.analyticsService.getReport(
        reportId,
        request.context.securityPrincipal as any
      );
      if (!report) {
        throw ApiError.notFound(`Report not found: '${reportId}'`);
      }
      return this.ok(request, report);
    } catch (err: any) {
      this.translateError(err);
    }
  }

  private async handleCompare(request: ApiRequest): Promise<ApiResponse<any>> {
    try {
      const body = (request.body as Record<string, any>) ?? {};
      const scope = this.extractScope(body.scope ?? request.query);
      if (!body.baseWindow || !body.compareWindow) {
        throw ApiError.badRequest('Historical comparison requires baseWindow and compareWindow');
      }
      const comparison = await this.analyticsService.compare(
        {
          scope,
          baseWindow: body.baseWindow,
          compareWindow: body.compareWindow,
          metricIds: body.metricIds,
          categories: body.categories,
        },
        request.context.securityPrincipal as any
      );
      return this.ok(request, comparison);
    } catch (err: any) {
      this.translateError(err);
    }
  }

  private async handleGetInsights(request: ApiRequest): Promise<ApiResponse<any>> {
    try {
      const scope = this.extractScope(request.query);
      const insights = await this.analyticsService.getInsights(
        scope,
        request.query as any,
        request.context.securityPrincipal as any
      );
      return this.ok(request, { insights, count: insights.length });
    } catch (err: any) {
      this.translateError(err);
    }
  }

  private async handleGetDataQuality(request: ApiRequest): Promise<ApiResponse<any>> {
    try {
      const scope = this.extractScope(request.query);
      const quality = await this.analyticsService.getDataQuality(
        scope,
        request.query as any,
        request.context.securityPrincipal as any
      );
      return this.ok(request, quality);
    } catch (err: any) {
      this.translateError(err);
    }
  }

  private extractScope(rawScope: any): AnalyticsScopeRef {
    if (!rawScope) {
      return { scopeType: 'INSTANCE' };
    }
    return {
      scopeType: rawScope.scopeType ?? (rawScope.workspaceId ? 'WORKSPACE' : 'INSTANCE'),
      workspaceId: rawScope.workspaceId,
      projectId: rawScope.projectId,
      repositoryId: rawScope.repositoryId,
      entityId: rawScope.entityId,
    };
  }

  private translateError(err: any): never {
    if (err instanceof MetricNotFoundError) {
      throw ApiError.notFound(err.message);
    }
    if (err instanceof ReportNotFoundError) {
      throw ApiError.notFound(err.message);
    }
    if (err instanceof InvalidMetricDefinitionError || err instanceof InvalidTimeWindowError) {
      throw ApiError.badRequest(err.message);
    }
    if (err instanceof AnalyticsScopeUnauthorizedError) {
      throw ApiError.forbidden(err.message);
    }
    throw err;
  }
}
