import type { IMetricsRegistry } from '../metrics/MetricTypes.js';
import type { ITracer } from '../tracing/TraceTypes.js';
import type { ObservabilityLogger } from '../logging/ObservabilityLogger.js';
import { CORE_METRIC_NAMES } from '../metrics/CoreMetrics.js';

export class AgentTelemetry {
  constructor(
    private readonly metricsRegistry: IMetricsRegistry,
    private readonly tracer: ITracer,
    private readonly logger: ObservabilityLogger
  ) {}

  public recordSessionStarted(sessionId: string, workspaceId?: string): void {
    this.metricsRegistry.gauge(CORE_METRIC_NAMES.AGENT_ACTIVE_SESSIONS).set(
      this.metricsRegistry.gauge(CORE_METRIC_NAMES.AGENT_ACTIVE_SESSIONS).getValue() + 1
    );

    this.logger.logEvent({
      level: 'INFO',
      service: 'projectmind',
      component: 'agent-runtime',
      operation: 'session_start',
      message: `Agent session ${sessionId} started`,
      sessionId,
      workspaceId,
      outcome: 'SUCCESS',
    });
  }

  public recordSessionEnded(sessionId: string, workspaceId?: string): void {
    const current = this.metricsRegistry.gauge(CORE_METRIC_NAMES.AGENT_ACTIVE_SESSIONS).getValue();
    this.metricsRegistry.gauge(CORE_METRIC_NAMES.AGENT_ACTIVE_SESSIONS).set(Math.max(0, current - 1));

    this.logger.logEvent({
      level: 'INFO',
      service: 'projectmind',
      component: 'agent-runtime',
      operation: 'session_end',
      message: `Agent session ${sessionId} ended`,
      sessionId,
      workspaceId,
      outcome: 'SUCCESS',
    });
  }

  public recordTaskCompleted(params: {
    readonly taskId: string;
    readonly sessionId?: string | undefined;
    readonly taskType: string;
    readonly durationMs: number;
    readonly success: boolean;
    readonly error?: unknown | undefined;
  }): void {
    const outcome = params.success ? 'SUCCESS' : 'FAILURE';
    const boundedType = params.taskType.substring(0, 32);

    this.metricsRegistry.counter(CORE_METRIC_NAMES.AGENT_TASKS_TOTAL).increment(1, {
      type: boundedType,
      outcome,
    });

    this.metricsRegistry.histogram(CORE_METRIC_NAMES.AGENT_TASK_DURATION_MS).record(params.durationMs, {
      type: boundedType,
      outcome,
    });

    if (!params.success) {
      this.metricsRegistry.counter(CORE_METRIC_NAMES.AGENT_TASK_FAILURES_TOTAL).increment(1, {
        type: boundedType,
      });
    }

    this.logger.logEvent({
      level: params.success ? 'INFO' : 'ERROR',
      service: 'projectmind',
      component: 'agent-runtime',
      operation: 'task_execution',
      message: `Agent task ${params.taskId} (${boundedType}) ${params.success ? 'succeeded' : 'failed'} in ${params.durationMs}ms`,
      taskId: params.taskId,
      sessionId: params.sessionId,
      durationMs: params.durationMs,
      outcome,
      errorCode: params.error instanceof Error ? params.error.name : undefined,
    });
  }

  public recordContextRefresh(sessionId: string): void {
    this.metricsRegistry.counter(CORE_METRIC_NAMES.AGENT_CONTEXT_REFRESHES_TOTAL).increment(1);

    this.logger.logEvent({
      level: 'DEBUG',
      service: 'projectmind',
      component: 'agent-runtime',
      operation: 'context_refresh',
      message: `Agent refreshed context for session ${sessionId}`,
      sessionId,
    });
  }
}
