import { describe, it, expect, beforeEach } from 'vitest';
import {
  DIContainer,
} from '../../src/workspace/di/DIContainer.js';
import {
  ObservabilityDISetup,
  ObservabilityTokens,
  CorrelationContext,
  type ObservabilityServices,
  type OperationalDashboardSummary,
} from '../../src/observability/index.js';

describe('Observability - End-to-End Integration & Dashboard Flow', () => {
  let container: DIContainer;
  let services: ObservabilityServices;

  beforeEach(() => {
    container = new DIContainer();
    services = ObservabilityDISetup.registerObservability(container);
  });

  it('correctly registers all observability singletons in the DI container', () => {
    expect(container.resolve(ObservabilityTokens.Logger)).toBe(services.logger);
    expect(container.resolve(ObservabilityTokens.MetricsRegistry)).toBe(services.metrics);
    expect(container.resolve(ObservabilityTokens.Tracer)).toBe(services.tracer);
    expect(container.resolve(ObservabilityTokens.HealthManager)).toBe(services.health);
    expect(container.resolve(ObservabilityTokens.DiagnosticManager)).toBe(services.diagnostics);
    expect(container.resolve(ObservabilityTokens.AlertManager)).toBe(services.alerts);
    expect(container.resolve(ObservabilityTokens.DashboardMetadataProvider)).toBe(services.dashboard);
  });

  it('executes end-to-end trace with ambient correlation across API, Context, and Storage layers', async () => {
    const rootContext = CorrelationContext.createRootContext({
      requestId: 'req-e2e-1',
      correlationId: 'corr-e2e-1',
      workspaceId: 'ws-mind',
      repositoryId: 'repo-mind',
    });

    await CorrelationContext.run(rootContext, async () => {
      // 1. API Request Span
      await services.tracer.withSpan('api_request', async (apiSpan) => {
        apiSpan.setAttribute('http.method', 'POST');
        apiSpan.setAttribute('http.route', '/api/v1/context');

        // Log entry auto-correlates
        services.logger.info({
          component: 'api',
          operation: 'handle_request',
          message: 'Received context request',
        });

        // 2. Context Orchestrator Span
        await services.tracer.withSpan('context_generation', async (ctxSpan) => {
          ctxSpan.setAttribute('context.resources', 3);

          // 3. Storage Layer Span
          await services.tracer.withSpan('storage_query', async (storageSpan) => {
            storageSpan.setAttribute('db.table', 'knowledge_nodes');
            services.metrics.histogram('db_query_duration_ms').record(15);
          });
        });

        apiSpan.setStatus('OK');
      });
    });

    const spans = services.tracer.getCompletedSpans();
    expect(spans).toHaveLength(3);

    const storageSpan = spans.find((s) => s.name === 'storage_query')!;
    const ctxSpan = spans.find((s) => s.name === 'context_generation')!;
    const apiSpan = spans.find((s) => s.name === 'api_request')!;

    // Correlation preserved across layers
    expect(storageSpan.traceId).toBe(apiSpan.traceId);
    expect(ctxSpan.traceId).toBe(apiSpan.traceId);
    expect(ctxSpan.parentSpanId).toBe(apiSpan.spanId);
    expect(storageSpan.parentSpanId).toBe(ctxSpan.spanId);

    const bufferedLogs = services.logger.getBufferedEvents();
    expect(bufferedLogs.length).toBeGreaterThan(0);
    expect(bufferedLogs[0]!.correlationId).toBe('corr-e2e-1');
    expect(bufferedLogs[0]!.requestId).toBe('req-e2e-1');
  });

  it('generates a machine-readable operational dashboard summary reflecting system state', async () => {
    // Simulate some requests and errors
    services.metrics.counter('api_requests_total').increment(10);
    services.metrics.counter('api_errors_total').increment(1);
    services.metrics.histogram('api_request_duration_ms').record(120);

    // Register health check
    services.health.registerCheck({
      name: 'sqlite_primary',
      category: 'DEPENDENCY',
      required: true,
      check: async () => ({ status: 'HEALTHY' }),
    });

    // Record diagnostic
    services.diagnostics.recordDiagnostic({
      category: 'CONFIGURATION',
      component: 'settings',
      severity: 'INFO',
      message: 'Config loaded with default values',
    });

    // Create an alert
    services.alerts.createAlert(
      'INFO',
      'SYSTEM',
      'startup',
      'READY',
      'System ready for traffic'
    );

    const summary: OperationalDashboardSummary = await services.dashboard.getDashboardSummary();

    expect(summary.timestamp).toBeDefined();
    expect(summary.service.name).toBe('projectmind');
    expect(summary.service.status).toBe('HEALTHY');
    expect(summary.trafficAndPerformance.totalRequests).toBe(10);
    expect(summary.trafficAndPerformance.totalErrors).toBe(1);
    expect(summary.trafficAndPerformance.errorRatePercentage).toBe(10);
    expect(summary.infrastructureHealth.overallHealth).toBe('HEALTHY');
    expect(summary.infrastructureHealth.criticalDependenciesHealthy).toBe(true);
    expect(summary.infrastructureHealth.components['sqlite_primary']?.status).toBe('HEALTHY');
    expect(summary.activeAlertsCount).toBe(1);
    expect(summary.activeDiagnosticsCount).toBe(1);
  });
});
