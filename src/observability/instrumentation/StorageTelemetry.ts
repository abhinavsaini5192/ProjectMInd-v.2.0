import type { IMetricsRegistry } from '../metrics/MetricTypes.js';
import type { ITracer } from '../tracing/TraceTypes.js';
import type { ObservabilityLogger } from '../logging/ObservabilityLogger.js';
import { CORE_METRIC_NAMES } from '../metrics/CoreMetrics.js';

export class StorageTelemetry {
  constructor(
    private readonly metricsRegistry: IMetricsRegistry,
    private readonly tracer: ITracer,
    private readonly logger: ObservabilityLogger
  ) {}

  public recordQuery(operation: string, table: string, durationMs: number, success: boolean): void {
    const boundedOp = operation.substring(0, 32);
    const boundedTable = table.substring(0, 32);

    this.metricsRegistry.histogram(CORE_METRIC_NAMES.STORAGE_QUERY_DURATION_MS).record(durationMs, {
      op: boundedOp,
      table: boundedTable,
    });
  }

  public recordTransactionFailure(reason: string): void {
    this.metricsRegistry.counter(CORE_METRIC_NAMES.STORAGE_TRANSACTION_FAILURES_TOTAL).increment(1, {
      reason: reason.substring(0, 32),
    });

    this.logger.logEvent({
      level: 'ERROR',
      service: 'projectmind',
      component: 'storage',
      operation: 'transaction',
      message: `Storage transaction failed: ${reason}`,
      outcome: 'FAILURE',
    });
  }

  public recordConnectionFailure(endpoint: string, reason: string): void {
    this.metricsRegistry.counter(CORE_METRIC_NAMES.STORAGE_CONNECTION_FAILURES_TOTAL).increment(1);

    this.logger.logEvent({
      level: 'FATAL',
      service: 'projectmind',
      component: 'storage',
      operation: 'connection',
      message: `Storage connection failed to ${endpoint}: ${reason}`,
      outcome: 'FAILURE',
    });
  }

  public recordMigration(version: number, durationMs: number, success: boolean, error?: unknown): void {
    if (!success) {
      this.metricsRegistry.counter(CORE_METRIC_NAMES.STORAGE_MIGRATION_FAILURES_TOTAL).increment(1, {
        version: String(version),
      });
    }

    this.logger.logEvent({
      level: success ? 'INFO' : 'FATAL',
      service: 'projectmind',
      component: 'storage-migrations',
      operation: 'migrate',
      message: `Database migration to v${version} ${success ? 'completed' : 'failed'} in ${durationMs}ms`,
      durationMs,
      outcome: success ? 'SUCCESS' : 'FAILURE',
      errorCode: error instanceof Error ? error.name : undefined,
    });
  }
}
