import type { CLICommand, CLICommandOption } from '../core/CLICommand.js';
import type { CLIContext } from '../core/CLIContext.js';
import { type CLIResult, createSuccessResult, createErrorResult } from '../core/CLIResult.js';
import { CLIExitCode } from '../core/CLIExitCode.js';
import type { IAnalyticsService } from '../../analytics/interfaces/IAnalyticsService.js';
import { MetricRegistry } from '../../analytics/registry/MetricRegistry.js';
import { InMemoryAnalyticsStore } from '../../analytics/storage/InMemoryAnalyticsStore.js';
import { AnalyticsAggregator } from '../../analytics/aggregation/AnalyticsAggregator.js';
import { DeterministicInsightEngine } from '../../analytics/insights/DeterministicInsightEngine.js';
import { AnalyticsReportService } from '../../analytics/reports/AnalyticsReportService.js';
import { AnalyticsService } from '../../analytics/services/AnalyticsService.js';
import type { AnalyticsScopeRef } from '../../analytics/models/AnalyticsScope.js';
import type { TimeWindowType } from '../../analytics/models/AnalyticsSnapshot.js';
import type { ReportType } from '../../analytics/models/AnalyticsReport.js';

export class AnalyticsCommand implements CLICommand {
  public readonly name = 'analytics';
  public readonly description = 'Enterprise Intelligence & Operational Analytics (Phase 9.9)';
  public readonly usage = 'projectmind analytics <overview|metrics|query|report|compare|quality|insights> [options]';

  public readonly options: readonly CLICommandOption[] = [
    { name: 'json', description: 'Output results in JSON format', hasValue: false },
    { name: 'workspace', description: 'Workspace ID filter', hasValue: true },
    { name: 'project', description: 'Project ID filter', hasValue: true },
    { name: 'window', description: 'Time window (SNAPSHOT, LAST_24H, LAST_7D, LAST_30D)', hasValue: true, defaultValue: 'LAST_24H' },
    { name: 'type', description: 'Report type (OVERVIEW, PLATFORM_USAGE, RELIABILITY, etc.)', hasValue: true, defaultValue: 'OVERVIEW' },
    { name: 'category', description: 'Metric category filter', hasValue: true },
    { name: 'metric', description: 'Specific metric ID', hasValue: true },
  ];

  public readonly examples: readonly string[] = [
    'projectmind analytics overview',
    'projectmind analytics metrics --category PLATFORM_USAGE',
    'projectmind analytics query --window LAST_7D --json',
    'projectmind analytics report --type RELIABILITY',
    'projectmind analytics compare --window LAST_7D',
    'projectmind analytics quality',
    'projectmind analytics insights',
  ];

  private readonly analyticsService: IAnalyticsService;

  constructor(analyticsService?: IAnalyticsService) {
    if (analyticsService) {
      this.analyticsService = analyticsService;
    } else {
      // Default standalone engine initialized with canonical metrics
      const metricRegistry = new MetricRegistry();
      const store = new InMemoryAnalyticsStore();
      const aggregator = new AnalyticsAggregator(store, metricRegistry);
      const insightEngine = new DeterministicInsightEngine();
      const reportService = new AnalyticsReportService(store, aggregator, insightEngine, metricRegistry);
      this.analyticsService = new AnalyticsService(metricRegistry, aggregator, reportService, insightEngine);
    }
  }

  public async execute(ctx: CLIContext): Promise<CLIResult> {
    const isJson = ctx.format === 'json' || Boolean(ctx.getOption('json'));
    const subcommand = ctx.args[0] || 'overview';

    const workspaceId = ctx.getOption('workspace') as string | undefined;
    const projectId = ctx.getOption('project') as string | undefined;
    const windowType = (ctx.getOption('window') as TimeWindowType) || 'LAST_24H';

    const scope: AnalyticsScopeRef = {
      scopeType: workspaceId ? 'WORKSPACE' : 'INSTANCE',
      workspaceId,
      projectId,
    };

    try {
      switch (subcommand) {
        case 'overview':
          return await this.handleOverview(isJson, scope, windowType);
        case 'metrics':
          return this.handleMetrics(ctx, isJson);
        case 'query':
          return await this.handleQuery(ctx, isJson, scope, windowType);
        case 'report':
          return await this.handleReport(ctx, isJson, scope, windowType);
        case 'compare':
          return await this.handleCompare(ctx, isJson, scope);
        case 'quality':
          return await this.handleQuality(isJson, scope, windowType);
        case 'insights':
          return await this.handleInsights(isJson, scope, windowType);
        default:
          return createErrorResult(
            this.name,
            CLIExitCode.INVALID_ARGUMENTS,
            `Unknown subcommand '${subcommand}'. Valid subcommands: overview, metrics, query, report, compare, quality, insights.`
          );
      }
    } catch (err: any) {
      return createErrorResult(this.name, CLIExitCode.GENERAL_ERROR, err.message);
    }
  }

  private async handleOverview(
    isJson: boolean,
    scope: AnalyticsScopeRef,
    windowType: TimeWindowType
  ): Promise<CLIResult> {
    const report = await this.analyticsService.generateReport(scope, 'OVERVIEW', { type: windowType });
    const lines: string[] = [
      `=== ${report.title} ===`,
      `Time Window: ${report.timeWindow.type} (${new Date(report.timeWindow.startMs).toISOString()} to ${new Date(report.timeWindow.endMs).toISOString()})`,
      `Data Quality: ${report.dataQuality.status} (Coverage: ${Math.round(report.dataQuality.coverageRatio * 100)}%)`,
      '',
      '--- Key Metrics ---',
    ];

    for (const [mId, res] of Object.entries(report.results)) {
      const valStr = res.value !== null ? `${res.value} ${res.unit}` : `N/A (${res.status})`;
      lines.push(`• ${mId}: ${valStr}`);
    }

    if (report.insights.length > 0) {
      lines.push('');
      lines.push('--- Deterministic Insights ---');
      for (const ins of report.insights) {
        lines.push(`[${ins.severity}] ${ins.title}: ${ins.pattern}`);
        lines.push(`  Recommendation: ${ins.recommendation}`);
      }
    }

    const message = lines.join('\n');
    return createSuccessResult(this.name, report, message);
  }

  private handleMetrics(ctx: CLIContext, isJson: boolean): CLIResult {
    const category = ctx.getOption('category') as any;
    const metrics = this.analyticsService.listMetrics(category);

    const lines: string[] = [
      `=== ProjectMind Canonical Metrics (${metrics.length}) ===`,
    ];
    for (const m of metrics) {
      lines.push(`• ${m.metricId} [${m.category}] (${m.unit}) v${m.definitionVersion}`);
      lines.push(`  ${m.description} (Source: ${m.authoritativeSource})`);
    }

    const message = lines.join('\n');
    return createSuccessResult(this.name, { count: metrics.length, metrics }, message);
  }

  private async handleQuery(
    ctx: CLIContext,
    isJson: boolean,
    scope: AnalyticsScopeRef,
    windowType: TimeWindowType
  ): Promise<CLIResult> {
    const metricOption = ctx.getOption('metric') as string | undefined;
    const metricIds = metricOption ? [metricOption] : undefined;

    const result = await this.analyticsService.query({
      scope,
      timeWindow: { type: windowType },
      metricIds,
    });

    const lines: string[] = [
      `=== Analytics Query Results ===`,
      `Scope: ${scope.scopeType} ${scope.workspaceId ?? 'global'}`,
      `Window: ${result.timeWindow.type}`,
      `Total records examined: ${result.totalRecordsExamined} (${result.executionDurationMs}ms)`,
      '',
    ];

    for (const [mId, res] of Object.entries(result.metrics)) {
      const valStr = res.value !== null ? `${res.value} ${res.unit}` : `N/A (${res.status})`;
      lines.push(`• ${mId}: ${valStr} [samples: ${res.sampleCount}]`);
    }

    const message = lines.join('\n');
    return createSuccessResult(this.name, result, message);
  }

  private async handleReport(
    ctx: CLIContext,
    isJson: boolean,
    scope: AnalyticsScopeRef,
    windowType: TimeWindowType
  ): Promise<CLIResult> {
    const rawType = (ctx.getOption('type') as string) || 'OVERVIEW';
    const reportType = rawType.toUpperCase() as ReportType;

    const report = await this.analyticsService.generateReport(scope, reportType, { type: windowType });

    const lines: string[] = [
      `=== ${report.title} ===`,
      `Report ID: ${report.reportId}`,
      `Generated At: ${new Date(report.generatedAt).toISOString()}`,
      `Data Quality: ${report.dataQuality.status}`,
      '',
      '--- Metrics ---',
    ];

    for (const [mId, res] of Object.entries(report.results)) {
      const valStr = res.value !== null ? `${res.value} ${res.unit}` : `N/A (${res.status})`;
      lines.push(`• ${mId}: ${valStr}`);
    }

    if (report.insights.length > 0) {
      lines.push('');
      lines.push('--- Insights ---');
      for (const ins of report.insights) {
        lines.push(`[${ins.severity}] ${ins.title}: ${ins.pattern}`);
        lines.push(`  Recommendation: ${ins.recommendation}`);
      }
    }

    const message = lines.join('\n');
    return createSuccessResult(this.name, report, message);
  }

  private async handleCompare(
    ctx: CLIContext,
    isJson: boolean,
    scope: AnalyticsScopeRef
  ): Promise<CLIResult> {
    const now = Date.now();
    const baseWindow = {
      type: 'CUSTOM' as const,
      startMs: now - 14 * 86_400_000,
      endMs: now - 7 * 86_400_000,
      timezone: 'UTC',
    };
    const compareWindow = {
      type: 'CUSTOM' as const,
      startMs: now - 7 * 86_400_000,
      endMs: now,
      timezone: 'UTC',
    };

    const compResult = await this.analyticsService.compare({
      scope,
      baseWindow,
      compareWindow,
    });

    const lines: string[] = [
      `=== Historical Trend Comparison ===`,
      `Base Window: ${new Date(baseWindow.startMs).toISOString()} to ${new Date(baseWindow.endMs).toISOString()}`,
      `Compare Window: ${new Date(compareWindow.startMs).toISOString()} to ${new Date(compareWindow.endMs).toISOString()}`,
      '',
    ];

    for (const [mId, item] of Object.entries(compResult.comparisons)) {
      lines.push(`• ${mId}: Base=${item.baseValue ?? 'N/A'}, Compare=${item.compareValue ?? 'N/A'} (Delta: ${item.absoluteDelta ?? 0}, Trend: ${item.trend})`);
    }

    const message = lines.join('\n');
    return createSuccessResult(this.name, compResult, message);
  }

  private async handleQuality(
    isJson: boolean,
    scope: AnalyticsScopeRef,
    windowType: TimeWindowType
  ): Promise<CLIResult> {
    const quality = await this.analyticsService.getDataQuality(scope, { type: windowType });

    const lines: string[] = [
      `=== Analytics Data Quality & Freshness ===`,
      `Status: ${quality.status}`,
      `Coverage Ratio: ${Math.round(quality.coverageRatio * 100)}%`,
    ];

    if (quality.warnings.length > 0) {
      lines.push('');
      lines.push('Warnings:');
      for (const w of quality.warnings) {
        lines.push(`  ⚠ ${w}`);
      }
    }

    if (quality.missingMetrics.length > 0) {
      lines.push('');
      lines.push(`Missing Metrics (${quality.missingMetrics.length}):`);
      for (const m of quality.missingMetrics.slice(0, 10)) {
        lines.push(`  - ${m}`);
      }
    }

    const message = lines.join('\n');
    return createSuccessResult(this.name, quality, message);
  }

  private async handleInsights(
    isJson: boolean,
    scope: AnalyticsScopeRef,
    windowType: TimeWindowType
  ): Promise<CLIResult> {
    const insights = await this.analyticsService.getInsights(scope, { type: windowType });

    if (insights.length === 0) {
      const msg = 'No anomalies or degraded trends detected. All monitored systems operating within target thresholds.';
      return createSuccessResult(this.name, { count: 0, insights: [] }, msg);
    }

    const lines: string[] = [`=== Deterministic Insights (${insights.length}) ===`];
    for (const ins of insights) {
      lines.push(`[${ins.severity}] ${ins.title}`);
      lines.push(`  Pattern: ${ins.pattern}`);
      lines.push(`  Recommendation: ${ins.recommendation}`);
      lines.push(`  Confidence: ${Math.round(ins.confidence * 100)}%`);
      lines.push('');
    }

    const message = lines.join('\n');
    return createSuccessResult(this.name, { count: insights.length, insights }, message);
  }
}
