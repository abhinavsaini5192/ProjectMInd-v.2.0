import { describe, it, expect, beforeEach } from 'vitest';
import { MetricRegistry } from '../../src/analytics/registry/MetricRegistry.js';
import { InMemoryAnalyticsStore } from '../../src/analytics/storage/InMemoryAnalyticsStore.js';
import { AnalyticsCollector } from '../../src/analytics/collection/AnalyticsCollector.js';
import { AnalyticsAggregator } from '../../src/analytics/aggregation/AnalyticsAggregator.js';
import { DeterministicInsightEngine } from '../../src/analytics/insights/DeterministicInsightEngine.js';
import { AnalyticsReportService } from '../../src/analytics/reports/AnalyticsReportService.js';
import { AnalyticsService } from '../../src/analytics/services/AnalyticsService.js';
import { AnalyticsController } from '../../src/api/controllers/AnalyticsController.js';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { ApiService } from '../../src/api/services/ApiService.js';
import { AnalyticsCommand } from '../../src/cli/commands/AnalyticsCommand.js';
import { CLIContext } from '../../src/cli/core/CLIContext.js';
import { CLIExitCode } from '../../src/cli/core/CLIExitCode.js';

describe('Phase 9.9 — API & CLI Integration', () => {
  let store: InMemoryAnalyticsStore;
  let registry: MetricRegistry;
  let service: AnalyticsService;
  let controller: AnalyticsController;
  let router: ApiRouter;
  let apiService: ApiService;
  let command: AnalyticsCommand;

  beforeEach(() => {
    store = new InMemoryAnalyticsStore();
    registry = new MetricRegistry();
    const collector = new AnalyticsCollector(store, registry);
    const aggregator = new AnalyticsAggregator(store, registry);
    const insightEngine = new DeterministicInsightEngine();
    const reportService = new AnalyticsReportService(store, aggregator, insightEngine, registry);
    service = new AnalyticsService(registry, aggregator, reportService, insightEngine);

    router = new ApiRouter();
    controller = new AnalyticsController(service);
    controller.registerRoutes(router);
    apiService = new ApiService({ router });

    command = new AnalyticsCommand(service);
  });

  it('Scenario 35: should handle API routes: GET /analytics/metrics and POST /analytics/reports', async () => {
    // 1. GET /analytics/metrics
    const metricsReq = {
      method: 'GET' as const,
      path: '/analytics/metrics',
      headers: {},
      params: {},
      query: { category: 'PLATFORM_USAGE' },
      body: undefined,
      context: { requestId: 'req_api_1', apiVersion: 'v1' },
    };
    const metricsRes = await apiService.handle(metricsReq as any);
    expect(metricsRes.status).toBe(200);
    expect(metricsRes.data?.metrics?.length).toBeGreaterThan(0);

    // 2. POST /analytics/reports
    const reportReq = {
      method: 'POST' as const,
      path: '/analytics/reports',
      headers: {},
      params: {},
      query: {},
      body: {
        type: 'PLATFORM_USAGE',
        scope: { scopeType: 'WORKSPACE', workspaceId: 'ws_api' },
        timeWindow: { type: 'LAST_24H' },
      },
      context: { requestId: 'req_api_2', apiVersion: 'v1' },
    };
    const reportRes = await apiService.handle(reportReq as any);
    expect(reportRes.status).toBe(201);
    expect(reportRes.data?.reportId).toBeDefined();
    expect(reportRes.data?.type).toBe('PLATFORM_USAGE');
  });

  it('Scenario 36: should execute CLI commands with JSON and formatted text output', async () => {
    // 1. Overview text
    const ctxOverview = new CLIContext({
      args: ['overview'],
      options: { workspace: 'ws_cli' },
    });
    const resOverview = await command.execute(ctxOverview);
    expect(resOverview.exitCode).toBe(CLIExitCode.SUCCESS);
    expect(resOverview.message).toContain('ProjectMind Enterprise Intelligence Overview');
    expect(resOverview.data).toBeDefined();

    // 2. Metrics JSON
    const ctxMetricsJson = new CLIContext({
      args: ['metrics'],
      options: { json: true, category: 'CONTEXT_INTELLIGENCE' },
    });
    const resMetrics = await command.execute(ctxMetricsJson);
    expect(resMetrics.exitCode).toBe(CLIExitCode.SUCCESS);
    expect((resMetrics.data as any)?.count).toBeGreaterThan(0);

    // 3. Quality text
    const ctxQuality = new CLIContext({
      args: ['quality'],
      options: { workspace: 'ws_cli' },
    });
    const resQuality = await command.execute(ctxQuality);
    expect(resQuality.exitCode).toBe(CLIExitCode.SUCCESS);
    expect(resQuality.message).toContain('Analytics Data Quality & Freshness');

    // 4. Insights text
    const ctxInsights = new CLIContext({
      args: ['insights'],
      options: { workspace: 'ws_cli' },
    });
    const resInsights = await command.execute(ctxInsights);
    expect(resInsights.exitCode).toBe(CLIExitCode.SUCCESS);
  });
});
