import type { IMetricsRegistry } from '../metrics/MetricTypes.js';
import type { ITracer, ISpan } from '../tracing/TraceTypes.js';
import type { ObservabilityLogger } from '../logging/ObservabilityLogger.js';
import { CORE_METRIC_NAMES } from '../metrics/CoreMetrics.js';

export type ContextPipelineStage =
  | 'INTENT_ANALYSIS'
  | 'FEATURE_RESOLUTION'
  | 'CONTEXT_PLANNING'
  | 'KNOWLEDGE_RETRIEVAL'
  | 'CONTEXT_EXPANSION'
  | 'RESOURCE_SELECTION'
  | 'TOKEN_BUDGETING'
  | 'CONTEXT_PACKING'
  | 'MODEL_FORMATTING';

export interface ContextGenerationTelemetryParams {
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly queryType?: string | undefined;
  readonly cacheHit?: boolean | undefined;
  readonly resourceCount?: number | undefined;
  readonly tokenBudgetUsed?: number | undefined;
  readonly durationMs: number;
  readonly success: boolean;
  readonly error?: unknown | undefined;
}

export class ContextTelemetry {
  constructor(
    private readonly metricsRegistry: IMetricsRegistry,
    private readonly tracer: ITracer,
    private readonly logger: ObservabilityLogger
  ) {}

  public recordContextGeneration(params: ContextGenerationTelemetryParams): void {
    const outcome = params.success ? 'SUCCESS' : 'FAILURE';

    // Metrics
    this.metricsRegistry.counter(CORE_METRIC_NAMES.CONTEXT_GENERATION_TOTAL).increment(1, {
      outcome,
      query_type: params.queryType ?? 'general',
    });

    this.metricsRegistry.histogram(CORE_METRIC_NAMES.CONTEXT_GENERATION_DURATION_MS).record(params.durationMs, {
      outcome,
    });

    if (params.cacheHit !== undefined) {
      if (params.cacheHit) {
        this.metricsRegistry.counter(CORE_METRIC_NAMES.CONTEXT_CACHE_HITS_TOTAL).increment(1);
      } else {
        this.metricsRegistry.counter(CORE_METRIC_NAMES.CONTEXT_CACHE_MISSES_TOTAL).increment(1);
      }
    }

    if (params.tokenBudgetUsed !== undefined) {
      this.metricsRegistry.histogram(CORE_METRIC_NAMES.CONTEXT_TOKEN_BUDGET_USAGE).record(params.tokenBudgetUsed);
    }

    // Structured Log (No raw prompt or source code included!)
    this.logger.logEvent({
      level: params.success ? 'INFO' : 'ERROR',
      service: 'projectmind',
      component: 'context-orchestrator',
      operation: 'generate_context',
      message: `Context generation ${params.success ? 'completed' : 'failed'} in ${params.durationMs}ms (resources=${params.resourceCount ?? 0}, cacheHit=${params.cacheHit ?? false})`,
      durationMs: params.durationMs,
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      outcome,
      errorCode: params.error instanceof Error ? params.error.name : undefined,
      metadata: {
        queryType: params.queryType,
        cacheHit: params.cacheHit,
        resourceCount: params.resourceCount,
        tokenBudgetUsed: params.tokenBudgetUsed,
      },
    });
  }

  public recordStageExecution<T>(
    stage: ContextPipelineStage,
    fn: (span: ISpan) => Promise<T> | T
  ): Promise<T> {
    return this.tracer.withSpan(`context.pipeline.${stage.toLowerCase()}`, async (span) => {
      span.setAttribute('context.stage', stage);
      const start = Date.now();
      try {
        const result = await fn(span);
        span.setAttribute('context.stage_duration_ms', Date.now() - start);
        return result;
      } catch (err) {
        span.recordException(err);
        throw err;
      }
    });
  }

  public recordCacheInvalidation(reason: string): void {
    this.metricsRegistry.counter(CORE_METRIC_NAMES.CONTEXT_INVALIDATIONS_TOTAL).increment(1, {
      reason: reason.substring(0, 32),
    });
  }
}
