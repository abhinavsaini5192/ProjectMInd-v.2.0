import type { IMetricsRegistry } from '../metrics/MetricTypes.js';
import type { ITracer } from '../tracing/TraceTypes.js';
import type { ObservabilityLogger } from '../logging/ObservabilityLogger.js';
import { CORE_METRIC_NAMES } from '../metrics/CoreMetrics.js';
import { CorrelationContext } from '../correlation/CorrelationContext.js';

export interface ApiTelemetryRecordOptions {
  readonly endpoint: string;
  readonly method: string;
  readonly apiVersion?: string | undefined;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly errorCode?: string | undefined;
  readonly requestId?: string | undefined;
  readonly correlationId?: string | undefined;
}

export class ApiTelemetry {
  constructor(
    private readonly metricsRegistry: IMetricsRegistry,
    private readonly tracer: ITracer,
    private readonly logger: ObservabilityLogger
  ) {}

  public recordRequest(options: ApiTelemetryRecordOptions): void {
    const isError = options.statusCode >= 400;
    const boundedStatus = String(options.statusCode);
    const boundedMethod = options.method.toUpperCase();
    const boundedEndpoint = options.endpoint.length > 64 ? options.endpoint.substring(0, 64) : options.endpoint;

    // 1. Metric: Request counter
    this.metricsRegistry.counter(CORE_METRIC_NAMES.API_REQUESTS_TOTAL).increment(1, {
      method: boundedMethod,
      endpoint: boundedEndpoint,
      status: boundedStatus,
    });

    // 2. Metric: Request latency
    this.metricsRegistry.histogram(CORE_METRIC_NAMES.API_REQUEST_DURATION_MS).record(options.durationMs, {
      method: boundedMethod,
      endpoint: boundedEndpoint,
    });

    // 3. Metric: Error counter
    if (isError) {
      this.metricsRegistry.counter(CORE_METRIC_NAMES.API_ERRORS_TOTAL).increment(1, {
        method: boundedMethod,
        endpoint: boundedEndpoint,
        status: boundedStatus,
        error_code: options.errorCode ?? 'UNKNOWN_ERROR',
      });
    }

    // 4. Structured Log
    const ambient = CorrelationContext.current();
    this.logger.logEvent({
      level: isError ? (options.statusCode >= 500 ? 'ERROR' : 'WARN') : 'INFO',
      service: 'projectmind',
      component: 'api',
      operation: `${boundedMethod} ${boundedEndpoint}`,
      message: `API HTTP ${options.statusCode} - ${boundedMethod} ${boundedEndpoint} [${options.durationMs}ms]`,
      durationMs: options.durationMs,
      requestId: options.requestId ?? ambient?.requestId,
      correlationId: options.correlationId ?? ambient?.correlationId,
      outcome: isError ? 'FAILURE' : 'SUCCESS',
      errorCode: options.errorCode,
      metadata: {
        method: boundedMethod,
        endpoint: boundedEndpoint,
        statusCode: options.statusCode,
      },
    });
  }
}
