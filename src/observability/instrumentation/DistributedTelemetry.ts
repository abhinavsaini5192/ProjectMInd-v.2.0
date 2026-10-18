import type { IMetricsRegistry } from '../metrics/MetricTypes.js';
import type { ITracer } from '../tracing/TraceTypes.js';
import type { ObservabilityLogger } from '../logging/ObservabilityLogger.js';
import { CORE_METRIC_NAMES } from '../metrics/CoreMetrics.js';

export class DistributedTelemetry {
  constructor(
    private readonly metricsRegistry: IMetricsRegistry,
    private readonly tracer: ITracer,
    private readonly logger: ObservabilityLogger
  ) {}

  public recordLockAcquired(lockKey: string, durationMs: number, holderId: string): void {
    const boundedKey = lockKey.substring(0, 32);
    this.metricsRegistry.counter(CORE_METRIC_NAMES.LOCK_ACQUISITIONS_TOTAL).increment(1, {
      status: 'acquired',
    });
    this.metricsRegistry.histogram(CORE_METRIC_NAMES.LOCK_ACQUISITION_DURATION_MS).record(durationMs, {
      lock: boundedKey,
    });

    this.logger.logEvent({
      level: 'DEBUG',
      service: 'projectmind',
      component: 'distributed-lock',
      operation: 'acquire_lock',
      message: `Distributed lock '${boundedKey}' acquired by holder '${holderId}' in ${durationMs}ms`,
      durationMs,
      outcome: 'SUCCESS',
      metadata: { lockKey: boundedKey, holderId },
    });
  }

  public recordLockFailed(lockKey: string, reason: string): void {
    const boundedKey = lockKey.substring(0, 32);
    this.metricsRegistry.counter(CORE_METRIC_NAMES.LOCK_ACQUISITIONS_TOTAL).increment(1, {
      status: 'failed',
    });
    this.metricsRegistry.counter(CORE_METRIC_NAMES.LOCK_ACQUISITION_FAILURES_TOTAL).increment(1, {
      reason: reason.substring(0, 32),
    });

    this.logger.logEvent({
      level: 'WARN',
      service: 'projectmind',
      component: 'distributed-lock',
      operation: 'acquire_lock',
      message: `Distributed lock '${boundedKey}' acquisition failed: ${reason}`,
      outcome: 'FAILURE',
      metadata: { lockKey: boundedKey, reason },
    });
  }

  public recordLockReleased(lockKey: string, heldDurationMs: number): void {
    const boundedKey = lockKey.substring(0, 32);
    this.logger.logEvent({
      level: 'DEBUG',
      service: 'projectmind',
      component: 'distributed-lock',
      operation: 'release_lock',
      message: `Distributed lock '${boundedKey}' released after ${heldDurationMs}ms`,
      durationMs: heldDurationMs,
      outcome: 'SUCCESS',
      metadata: { lockKey: boundedKey },
    });
  }

  public recordOutboxBatch(batchSize: number, durationMs: number, failures: number): void {
    const successes = Math.max(0, batchSize - failures);
    if (successes > 0) {
      this.metricsRegistry.counter(CORE_METRIC_NAMES.OUTBOX_DISPATCHED_TOTAL).increment(successes);
    }
    if (failures > 0) {
      this.metricsRegistry.counter(CORE_METRIC_NAMES.OUTBOX_FAILED_TOTAL).increment(failures);
    }

    this.logger.logEvent({
      level: failures > 0 ? 'WARN' : 'INFO',
      service: 'projectmind',
      component: 'outbox-dispatcher',
      operation: 'dispatch_batch',
      message: `Outbox batch dispatched: ${successes} succeeded, ${failures} failed in ${durationMs}ms`,
      durationMs,
      outcome: failures === 0 ? 'SUCCESS' : 'FAILURE',
      metadata: { batchSize, successes, failures },
    });
  }

  public recordInboxProcessed(eventType: string, durationMs: number, duplicate: boolean): void {
    const boundedType = eventType.substring(0, 32);
    this.metricsRegistry.counter(CORE_METRIC_NAMES.INBOX_PROCESSED_TOTAL).increment(1, {
      type: boundedType,
      duplicate: String(duplicate),
    });

    this.logger.logEvent({
      level: 'DEBUG',
      service: 'projectmind',
      component: 'inbox-processor',
      operation: 'process_event',
      message: `Inbound event '${boundedType}' processed in ${durationMs}ms (duplicate: ${duplicate})`,
      durationMs,
      outcome: 'SUCCESS',
      metadata: { eventType: boundedType, duplicate },
    });
  }

  public recordCacheOperation(
    operation: 'get' | 'set' | 'delete',
    outcome: 'hit' | 'miss' | 'error',
    durationMs: number
  ): void {
    const metricName =
      outcome === 'hit'
        ? CORE_METRIC_NAMES.CONTEXT_CACHE_HITS_TOTAL
        : outcome === 'miss'
        ? CORE_METRIC_NAMES.CONTEXT_CACHE_MISSES_TOTAL
        : CORE_METRIC_NAMES.CONTEXT_INVALIDATIONS_TOTAL;

    this.metricsRegistry.counter(metricName).increment(1, {
      op: operation,
    });
  }

  public updateQueueDepth(depth: number, priority?: string): void {
    this.metricsRegistry.gauge(CORE_METRIC_NAMES.JOB_QUEUE_DEPTH).set(depth, {
      priority: priority ?? 'all',
    });
  }

  public updateWorkerCounts(active: number, busy: number): void {
    this.metricsRegistry.gauge(CORE_METRIC_NAMES.WORKERS_ACTIVE).set(active);
    this.metricsRegistry.gauge(CORE_METRIC_NAMES.WORKERS_BUSY).set(busy);
  }
}
