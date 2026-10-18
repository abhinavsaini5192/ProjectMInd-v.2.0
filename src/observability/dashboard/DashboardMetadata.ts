import type { IHealthManager, HealthStatus } from '../health/HealthTypes.js';
import type { IMetricsRegistry } from '../metrics/MetricTypes.js';
import type { IDiagnosticManager } from '../diagnostics/DiagnosticTypes.js';
import type { IAlertManager, Alert } from '../operations/AlertTypes.js';
import { CORE_METRIC_NAMES } from '../metrics/CoreMetrics.js';

export interface OperationalDashboardSummary {
  readonly timestamp: string;
  readonly service: {
    readonly name: string;
    readonly version: string;
    readonly status: HealthStatus;
    readonly uptimeSeconds: number;
    readonly environment: string;
  };
  readonly trafficAndPerformance: {
    readonly totalRequests: number;
    readonly totalErrors: number;
    readonly errorRatePercentage: number;
    readonly apiLatencyStats: {
      readonly count: number;
      readonly avgMs: number;
      readonly p50Ms: number;
      readonly p90Ms: number;
      readonly p99Ms: number;
    };
  };
  readonly infrastructureHealth: {
    readonly overallHealth: HealthStatus;
    readonly criticalDependenciesHealthy: boolean;
    readonly components: Record<string, { status: HealthStatus; durationMs: number; message?: string | undefined }>;
  };
  readonly subsystems: {
    readonly context: {
      readonly generationTotal: number;
      readonly cacheHitRatePercentage: number;
    };
    readonly knowledge: {
      readonly updatesTotal: number;
      readonly failuresTotal: number;
      readonly conflictsTotal: number;
      readonly retriesTotal: number;
    };
    readonly agent: {
      readonly activeSessions: number;
      readonly tasksTotal: number;
      readonly taskFailuresTotal: number;
    };
    readonly verification: {
      readonly runsTotal: number;
    };
    readonly storage: {
      readonly transactionFailures: number;
      readonly connectionFailures: number;
      readonly migrationFailures: number;
    };
  };
  readonly activeAlertsCount: number;
  readonly activeAlerts: readonly Alert[];
  readonly activeDiagnosticsCount: number;
}

export class DashboardMetadataProvider {
  constructor(
    private readonly healthManager: IHealthManager,
    private readonly metricsRegistry: IMetricsRegistry,
    private readonly diagnosticManager: IDiagnosticManager,
    private readonly alertManager: IAlertManager,
    private readonly serviceName: string = 'projectmind',
    private readonly serviceVersion: string = '1.0.0',
    private readonly environment: string = 'production'
  ) {}

  public async getDashboardSummary(): Promise<OperationalDashboardSummary> {
    const health = await this.healthManager.getHealth();
    const liveness = this.healthManager.getLiveness();
    const metricsSnapshot = this.metricsRegistry.getSnapshot();
    const activeAlerts = this.alertManager.getActiveAlerts();
    const activeDiagnostics = this.diagnosticManager.getActiveDiagnostics();

    // Compute request totals & error rate
    const reqCounter = metricsSnapshot.counters[CORE_METRIC_NAMES.API_REQUESTS_TOTAL];
    const totalRequests = reqCounter?.series.reduce((sum, s) => sum + s.value, 0) ?? 0;

    const errCounter = metricsSnapshot.counters[CORE_METRIC_NAMES.API_ERRORS_TOTAL];
    const totalErrors = errCounter?.series.reduce((sum, s) => sum + s.value, 0) ?? 0;

    const errorRate = totalRequests > 0 ? Math.round((totalErrors / totalRequests) * 10000) / 100 : 0;

    // Latency stats
    const latencyHisto = metricsSnapshot.histograms[CORE_METRIC_NAMES.API_REQUEST_DURATION_MS];
    const latencySeries = latencyHisto?.series[0]?.value;

    // Context stats
    const ctxGenCounter = metricsSnapshot.counters[CORE_METRIC_NAMES.CONTEXT_GENERATION_TOTAL];
    const ctxGenTotal = ctxGenCounter?.series.reduce((sum, s) => sum + s.value, 0) ?? 0;

    const hits = metricsSnapshot.counters[CORE_METRIC_NAMES.CONTEXT_CACHE_HITS_TOTAL]?.series.reduce((s, x) => s + x.value, 0) ?? 0;
    const misses = metricsSnapshot.counters[CORE_METRIC_NAMES.CONTEXT_CACHE_MISSES_TOTAL]?.series.reduce((s, x) => s + x.value, 0) ?? 0;
    const totalCacheOps = hits + misses;
    const hitRate = totalCacheOps > 0 ? Math.round((hits / totalCacheOps) * 10000) / 100 : 0;

    // Subsystems
    const kuTotal = metricsSnapshot.counters[CORE_METRIC_NAMES.KNOWLEDGE_UPDATES_TOTAL]?.series.reduce((s, x) => s + x.value, 0) ?? 0;
    const kuFail = metricsSnapshot.counters[CORE_METRIC_NAMES.KNOWLEDGE_UPDATE_FAILURES_TOTAL]?.series.reduce((s, x) => s + x.value, 0) ?? 0;
    const kuConf = metricsSnapshot.counters[CORE_METRIC_NAMES.KNOWLEDGE_CONFLICTS_TOTAL]?.series.reduce((s, x) => s + x.value, 0) ?? 0;
    const kuRetries = metricsSnapshot.counters[CORE_METRIC_NAMES.KNOWLEDGE_RETRIES_TOTAL]?.series.reduce((s, x) => s + x.value, 0) ?? 0;

    const agentSessions = metricsSnapshot.gauges[CORE_METRIC_NAMES.AGENT_ACTIVE_SESSIONS]?.series.reduce((s, x) => s + x.value, 0) ?? 0;
    const agentTasks = metricsSnapshot.counters[CORE_METRIC_NAMES.AGENT_TASKS_TOTAL]?.series.reduce((s, x) => s + x.value, 0) ?? 0;
    const agentTaskFailures = metricsSnapshot.counters[CORE_METRIC_NAMES.AGENT_TASK_FAILURES_TOTAL]?.series.reduce((s, x) => s + x.value, 0) ?? 0;

    const verifTotal = metricsSnapshot.counters[CORE_METRIC_NAMES.VERIFICATION_RUNS_TOTAL]?.series.reduce((s, x) => s + x.value, 0) ?? 0;

    const txFail = metricsSnapshot.counters[CORE_METRIC_NAMES.STORAGE_TRANSACTION_FAILURES_TOTAL]?.series.reduce((s, x) => s + x.value, 0) ?? 0;
    const connFail = metricsSnapshot.counters[CORE_METRIC_NAMES.STORAGE_CONNECTION_FAILURES_TOTAL]?.series.reduce((s, x) => s + x.value, 0) ?? 0;
    const migFail = metricsSnapshot.counters[CORE_METRIC_NAMES.STORAGE_MIGRATION_FAILURES_TOTAL]?.series.reduce((s, x) => s + x.value, 0) ?? 0;

    const componentsSummary: Record<string, { status: HealthStatus; durationMs: number; message?: string | undefined }> = {};
    for (const [k, v] of Object.entries(health.components)) {
      componentsSummary[k] = {
        status: v.status,
        durationMs: v.durationMs,
        message: v.message,
      };
    }

    return {
      timestamp: new Date().toISOString(),
      service: {
        name: this.serviceName,
        version: this.serviceVersion,
        status: health.status,
        uptimeSeconds: Math.round(liveness.uptimeMs / 1000),
        environment: this.environment,
      },
      trafficAndPerformance: {
        totalRequests,
        totalErrors,
        errorRatePercentage: errorRate,
        apiLatencyStats: {
          count: latencySeries?.count ?? 0,
          avgMs: latencySeries?.avg ?? 0,
          p50Ms: latencySeries?.p50 ?? 0,
          p90Ms: latencySeries?.p90 ?? 0,
          p99Ms: latencySeries?.p99 ?? 0,
        },
      },
      infrastructureHealth: {
        overallHealth: health.status,
        criticalDependenciesHealthy: health.readiness.criticalDependenciesHealthy,
        components: componentsSummary,
      },
      subsystems: {
        context: {
          generationTotal: ctxGenTotal,
          cacheHitRatePercentage: hitRate,
        },
        knowledge: {
          updatesTotal: kuTotal,
          failuresTotal: kuFail,
          conflictsTotal: kuConf,
          retriesTotal: kuRetries,
        },
        agent: {
          activeSessions: agentSessions,
          tasksTotal: agentTasks,
          taskFailuresTotal: agentTaskFailures,
        },
        verification: {
          runsTotal: verifTotal,
        },
        storage: {
          transactionFailures: txFail,
          connectionFailures: connFail,
          migrationFailures: migFail,
        },
      },
      activeAlertsCount: activeAlerts.length,
      activeAlerts,
      activeDiagnosticsCount: activeDiagnostics.length,
    };
  }
}
