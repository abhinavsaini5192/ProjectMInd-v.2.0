import type { IMetricsRegistry } from '../metrics/MetricTypes.js';
import type { ITracer } from '../tracing/TraceTypes.js';
import type { ObservabilityLogger } from '../logging/ObservabilityLogger.js';
import { CORE_METRIC_NAMES } from '../metrics/CoreMetrics.js';

export interface KnowledgeUpdateTelemetryParams {
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly updateType: string;
  readonly status: 'ACCEPTED' | 'REJECTED' | 'CONFLICT' | 'RETRY' | 'FAILED';
  readonly durationMs: number;
  readonly retryCount?: number | undefined;
  readonly reason?: string | undefined;
}

export class KnowledgeTelemetry {
  constructor(
    private readonly metricsRegistry: IMetricsRegistry,
    private readonly tracer: ITracer,
    private readonly logger: ObservabilityLogger
  ) {}

  public recordUpdate(params: KnowledgeUpdateTelemetryParams): void {
    // 1. Metric: Total updates
    this.metricsRegistry.counter(CORE_METRIC_NAMES.KNOWLEDGE_UPDATES_TOTAL).increment(1, {
      type: params.updateType.substring(0, 32),
      status: params.status,
    });

    // 2. Metric: Duration
    this.metricsRegistry.histogram(CORE_METRIC_NAMES.KNOWLEDGE_UPDATE_DURATION_MS).record(params.durationMs, {
      type: params.updateType.substring(0, 32),
      status: params.status,
    });

    // 3. Status-specific metrics
    if (params.status === 'FAILED') {
      this.metricsRegistry.counter(CORE_METRIC_NAMES.KNOWLEDGE_UPDATE_FAILURES_TOTAL).increment(1, {
        type: params.updateType.substring(0, 32),
      });
    } else if (params.status === 'CONFLICT') {
      this.metricsRegistry.counter(CORE_METRIC_NAMES.KNOWLEDGE_CONFLICTS_TOTAL).increment(1, {
        type: params.updateType.substring(0, 32),
      });
    } else if (params.status === 'RETRY') {
      this.metricsRegistry.counter(CORE_METRIC_NAMES.KNOWLEDGE_RETRIES_TOTAL).increment(1, {
        type: params.updateType.substring(0, 32),
      });
    }

    // 4. Structured log
    this.logger.logEvent({
      level: params.status === 'FAILED' ? 'ERROR' : params.status === 'CONFLICT' ? 'WARN' : 'INFO',
      service: 'projectmind',
      component: 'knowledge-subsystem',
      operation: 'update_knowledge',
      message: `Knowledge update ${params.status.toLowerCase()} in ${params.durationMs}ms [type=${params.updateType}]`,
      durationMs: params.durationMs,
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      outcome: params.status === 'ACCEPTED' ? 'SUCCESS' : 'FAILURE',
      metadata: {
        updateType: params.updateType,
        status: params.status,
        retryCount: params.retryCount,
        reason: params.reason,
      },
    });
  }
}
