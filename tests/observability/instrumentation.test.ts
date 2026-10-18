import { describe, it, expect, beforeEach } from 'vitest';
import {
  MetricsRegistry,
  Tracer,
  ObservabilityLogger,
  AlertManager,
  ApiTelemetry,
  ContextTelemetry,
  KnowledgeTelemetry,
  AgentTelemetry,
  StorageTelemetry,
  SecurityTelemetry,
  VerificationTelemetry,
  CORE_METRIC_NAMES,
  type LogEvent,
} from '../../src/observability/index.js';

describe('Observability - Domain Subsystem Instrumentation', () => {
  let metrics: MetricsRegistry;
  let tracer: Tracer;
  let capturedLogs: LogEvent[];
  let logger: ObservabilityLogger;
  let alerts: AlertManager;

  beforeEach(() => {
    metrics = new MetricsRegistry();
    tracer = new Tracer();
    capturedLogs = [];
    logger = new ObservabilityLogger({
      sink: (_line, event) => capturedLogs.push(event),
    });
    alerts = new AlertManager();
  });

  it('instruments API layer with latency and status metrics and structured log', () => {
    const apiTel = new ApiTelemetry(metrics, tracer, logger);

    apiTel.recordRequest({
      endpoint: '/api/v1/context',
      method: 'POST',
      statusCode: 200,
      durationMs: 145,
      requestId: 'req-abc',
      correlationId: 'corr-xyz',
    });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters[CORE_METRIC_NAMES.API_REQUESTS_TOTAL]?.series[0]?.value).toBe(1);
    expect(snapshot.histograms[CORE_METRIC_NAMES.API_REQUEST_DURATION_MS]?.series[0]?.value.count).toBe(1);

    expect(capturedLogs).toHaveLength(1);
    const log = capturedLogs[0]!;
    expect(log.operation).toBe('POST /api/v1/context');
    expect(log.outcome).toBe('SUCCESS');
    expect(log.requestId).toBe('req-abc');
  });

  it('instruments Context Orchestrator without leaking source code or prompts', async () => {
    const contextTel = new ContextTelemetry(metrics, tracer, logger);

    // Instrument a pipeline stage
    await contextTel.recordStageExecution('INTENT_ANALYSIS', async (span) => {
      span.setAttribute('intent.type', 'code_review');
      return true;
    });

    contextTel.recordContextGeneration({
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      queryType: 'symbol_lookup',
      cacheHit: true,
      resourceCount: 4,
      tokenBudgetUsed: 1200,
      durationMs: 250,
      success: true,
    });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters[CORE_METRIC_NAMES.CONTEXT_GENERATION_TOTAL]?.series[0]?.value).toBe(1);
    expect(snapshot.counters[CORE_METRIC_NAMES.CONTEXT_CACHE_HITS_TOTAL]?.series[0]?.value).toBe(1);
    expect(snapshot.histograms[CORE_METRIC_NAMES.CONTEXT_TOKEN_BUDGET_USAGE]?.series[0]?.value.count).toBe(1);

    const spans = tracer.getCompletedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]!.name).toBe('context.pipeline.intent_analysis');

    expect(capturedLogs).toHaveLength(1);
    expect(capturedLogs[0]!.message).toContain('Context generation completed in 250ms');
  });

  it('instruments Knowledge Updates and tracks conflicts, retries, and failures', () => {
    const knowledgeTel = new KnowledgeTelemetry(metrics, tracer, logger);

    knowledgeTel.recordUpdate({
      updateType: 'symbol_graph',
      status: 'CONFLICT',
      durationMs: 45,
      reason: 'Concurrent file edit detected',
    });

    knowledgeTel.recordUpdate({
      updateType: 'symbol_graph',
      status: 'RETRY',
      durationMs: 30,
      retryCount: 1,
    });

    knowledgeTel.recordUpdate({
      updateType: 'symbol_graph',
      status: 'ACCEPTED',
      durationMs: 60,
    });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters[CORE_METRIC_NAMES.KNOWLEDGE_CONFLICTS_TOTAL]?.series[0]?.value).toBe(1);
    expect(snapshot.counters[CORE_METRIC_NAMES.KNOWLEDGE_RETRIES_TOTAL]?.series[0]?.value).toBe(1);
    expect(snapshot.counters[CORE_METRIC_NAMES.KNOWLEDGE_UPDATES_TOTAL]?.series).toHaveLength(3);
  });

  it('instruments Agent Runtime sessions and tasks without conversation leakage', () => {
    const agentTel = new AgentTelemetry(metrics, tracer, logger);

    agentTel.recordSessionStarted('session-123', 'ws-1');
    expect(metrics.getSnapshot().gauges[CORE_METRIC_NAMES.AGENT_ACTIVE_SESSIONS]?.series[0]?.value).toBe(1);

    agentTel.recordTaskCompleted({
      taskId: 'task-999',
      sessionId: 'session-123',
      taskType: 'feature_extraction',
      durationMs: 500,
      success: true,
    });

    expect(metrics.getSnapshot().counters[CORE_METRIC_NAMES.AGENT_TASKS_TOTAL]?.series[0]?.value).toBe(1);

    agentTel.recordSessionEnded('session-123', 'ws-1');
    expect(metrics.getSnapshot().gauges[CORE_METRIC_NAMES.AGENT_ACTIVE_SESSIONS]?.series[0]?.value).toBe(0);
  });

  it('instruments Storage operations, migrations, and transaction failures', () => {
    const storageTel = new StorageTelemetry(metrics, tracer, logger);

    storageTel.recordQuery('SELECT', 'nodes', 12, true);
    storageTel.recordTransactionFailure('sqlite_busy');
    storageTel.recordMigration(2, 450, true);

    const snapshot = metrics.getSnapshot();
    expect(snapshot.histograms[CORE_METRIC_NAMES.STORAGE_QUERY_DURATION_MS]?.series[0]?.value.count).toBe(1);
    expect(snapshot.counters[CORE_METRIC_NAMES.STORAGE_TRANSACTION_FAILURES_TOTAL]?.series[0]?.value).toBe(1);

    expect(capturedLogs.some((l) => l.component === 'storage-migrations')).toBe(true);
  });

  it('instruments Security and triggers alerts on repeated authentication failures', () => {
    const secTel = new SecurityTelemetry(metrics, logger, alerts, 3);

    secTel.recordAuthFailure('Invalid signature', 'user-1');
    secTel.recordAuthFailure('Invalid signature', 'user-1');
    secTel.recordAuthFailure('Invalid signature', 'user-1'); // triggers threshold 3

    expect(metrics.getSnapshot().counters[CORE_METRIC_NAMES.SECURITY_AUTH_FAILURES_TOTAL]?.series[0]?.value).toBe(3);

    const activeAlerts = alerts.getActiveAlerts();
    expect(activeAlerts).toHaveLength(1);
    expect(activeAlerts[0]!.condition).toBe('SUSPICIOUS_AUTH_FAILURES');
  });

  it('instruments Verification runs and records rule outcomes and durations', () => {
    const verifTel = new VerificationTelemetry(metrics, tracer, logger);

    verifTel.recordVerificationRun({
      ruleId: 'RULE-NO-CYCLES',
      passed: true,
      durationMs: 18,
      violationsCount: 0,
    });

    const snapshot = metrics.getSnapshot();
    expect(snapshot.counters[CORE_METRIC_NAMES.VERIFICATION_RUNS_TOTAL]?.series[0]?.value).toBe(1);
    expect(snapshot.counters[CORE_METRIC_NAMES.VERIFICATION_RESULTS_TOTAL]?.series[0]?.value).toBe(1);
    expect(snapshot.histograms[CORE_METRIC_NAMES.VERIFICATION_DURATION_MS]?.series[0]?.value.count).toBe(1);
  });
});
