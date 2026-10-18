import type { IMetricsRegistry } from '../../observability/metrics/MetricTypes.js';
import type { ITracer } from '../../observability/tracing/TraceTypes.js';
import type { ObservabilityLogger } from '../../observability/logging/ObservabilityLogger.js';
import type { ConcurrencyConflict } from '../models/Conflict.js';

export const CONCURRENCY_METRIC_NAMES = {
  LOCK_ACQUISITIONS_TOTAL: 'concurrency_lock_acquisitions_total',
  LOCK_WAIT_DURATION_MS: 'concurrency_lock_wait_duration_ms',
  ACTIVE_LOCKS: 'concurrency_active_locks',
  LOCK_CONTENTIONS_TOTAL: 'concurrency_lock_contentions_total',
  LOCK_EXPIRED_TOTAL: 'concurrency_lock_expired_total',
  CONFLICTS_TOTAL: 'concurrency_conflicts_total',
  COALESCED_REQUESTS_TOTAL: 'concurrency_coalesced_requests_total',
  STALE_RESULTS_TOTAL: 'concurrency_stale_results_total',
  WORKLOAD_PERMITS_IN_USE: 'concurrency_workload_permits_in_use',
  WORKLOAD_REJECTED_TOTAL: 'concurrency_workload_rejected_total',
} as const;

export interface ConcurrencyHealthDiagnostic {
  readonly status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  readonly activeLocks: number;
  readonly contentions: number;
  readonly conflicts: number;
  readonly coalescedRequests: number;
  readonly staleResults: number;
  readonly contentionRate: number;
  readonly message?: string | undefined;
}

export class ConcurrencyTelemetry {
  private totalAcquisitions = 0;
  private totalContentions = 0;
  private totalConflicts = 0;
  private totalCoalesced = 0;
  private totalStale = 0;
  private currentActiveLocks = 0;

  constructor(
    private readonly metrics?: IMetricsRegistry | undefined,
    private readonly tracer?: ITracer | undefined,
    private readonly logger?: ObservabilityLogger | undefined
  ) {}

  public recordLockAcquired(
    resourceKey: string,
    durationMs: number,
    ownerId: string,
    correlationId?: string
  ): void {
    this.totalAcquisitions++;
    this.currentActiveLocks++;

    const scope = resourceKey.split(':')[0] ?? 'resource';
    this.metrics?.counter(CONCURRENCY_METRIC_NAMES.LOCK_ACQUISITIONS_TOTAL).increment(1, {
      outcome: 'SUCCESS',
      scope,
    });
    this.metrics?.histogram(CONCURRENCY_METRIC_NAMES.LOCK_WAIT_DURATION_MS).record(durationMs, {
      scope,
    });
    this.metrics?.gauge(CONCURRENCY_METRIC_NAMES.ACTIVE_LOCKS).set(this.currentActiveLocks);

    this.logger?.logEvent({
      level: 'INFO',
      service: 'projectmind',
      component: 'resource-lock',
      operation: 'acquire_lock',
      message: `Lock acquired on '${resourceKey}' by owner '${ownerId}' (wait=${durationMs}ms)`,
      correlationId,
      outcome: 'SUCCESS',
      metadata: { resourceKey, ownerId, durationMs },
    });
  }

  public recordLockContended(resourceKey: string, ownerId: string): void {
    this.totalContentions++;
    const scope = resourceKey.split(':')[0] ?? 'resource';

    this.metrics?.counter(CONCURRENCY_METRIC_NAMES.LOCK_CONTENTIONS_TOTAL).increment(1, { scope });
    this.metrics?.counter(CONCURRENCY_METRIC_NAMES.LOCK_ACQUISITIONS_TOTAL).increment(1, {
      outcome: 'CONTENTION',
      scope,
    });

    this.logger?.logEvent({
      level: 'WARN',
      service: 'projectmind',
      component: 'resource-lock',
      operation: 'acquire_lock',
      message: `Lock contention on '${resourceKey}' requested by owner '${ownerId}'`,
      outcome: 'FAILURE',
      metadata: { resourceKey, ownerId },
    });
  }

  public recordLockReleased(resourceKey: string, ownerId: string): void {
    this.currentActiveLocks = Math.max(0, this.currentActiveLocks - 1);
    this.metrics?.gauge(CONCURRENCY_METRIC_NAMES.ACTIVE_LOCKS).set(this.currentActiveLocks);

    this.logger?.logEvent({
      level: 'INFO',
      service: 'projectmind',
      component: 'resource-lock',
      operation: 'release_lock',
      message: `Lock released on '${resourceKey}' by owner '${ownerId}'`,
      outcome: 'SUCCESS',
      metadata: { resourceKey, ownerId },
    });
  }

  public recordLockExpired(resourceKey: string): void {
    this.currentActiveLocks = Math.max(0, this.currentActiveLocks - 1);
    this.metrics?.counter(CONCURRENCY_METRIC_NAMES.LOCK_EXPIRED_TOTAL).increment(1);
    this.metrics?.gauge(CONCURRENCY_METRIC_NAMES.ACTIVE_LOCKS).set(this.currentActiveLocks);

    this.logger?.logEvent({
      level: 'WARN',
      service: 'projectmind',
      component: 'resource-lock',
      operation: 'lock_expired',
      message: `Stale lock on '${resourceKey}' expired and reclaimed`,
      outcome: 'SUCCESS',
      metadata: { resourceKey },
    });
  }

  public recordConflict(conflict: ConcurrencyConflict): void {
    this.totalConflicts++;
    this.metrics?.counter(CONCURRENCY_METRIC_NAMES.CONFLICTS_TOTAL).increment(1, {
      type: conflict.type,
      action: conflict.action,
    });

    this.logger?.logEvent({
      level: conflict.retryable ? 'WARN' : 'ERROR',
      service: 'projectmind',
      component: 'conflict-resolver',
      operation: 'resolve_conflict',
      message: `Concurrency conflict [${conflict.type}] on '${conflict.resourceKey}': ${conflict.action}`,
      outcome: conflict.retryable ? 'SUCCESS' : 'FAILURE',
      metadata: {
        conflictId: conflict.conflictId,
        type: conflict.type,
        action: conflict.action,
        retryable: conflict.retryable,
      },
    });
  }

  public recordCoalescedRequest(operation: string): void {
    this.totalCoalesced++;
    this.metrics?.counter(CONCURRENCY_METRIC_NAMES.COALESCED_REQUESTS_TOTAL).increment(1, {
      operation,
    });
  }

  public recordStaleResult(resourceId: string, inputVersion: number, currentVersion: number): void {
    this.totalStale++;
    this.metrics?.counter(CONCURRENCY_METRIC_NAMES.STALE_RESULTS_TOTAL).increment(1);

    this.logger?.logEvent({
      level: 'WARN',
      service: 'projectmind',
      component: 'stale-result-detector',
      operation: 'check_freshness',
      message: `Stale result detected for resource '${resourceId}': input=${inputVersion}, current=${currentVersion}`,
      outcome: 'FAILURE',
      metadata: { resourceId, inputVersion, currentVersion },
    });
  }

  public recordWorkloadPermitAllocated(workspaceId: string, inUse: number): void {
    this.metrics?.gauge(CONCURRENCY_METRIC_NAMES.WORKLOAD_PERMITS_IN_USE).set(inUse, {
      workspace_id: workspaceId,
    });
  }

  public recordWorkloadRejected(workspaceId: string, reason: string): void {
    this.metrics?.counter(CONCURRENCY_METRIC_NAMES.WORKLOAD_REJECTED_TOTAL).increment(1, {
      workspace_id: workspaceId,
    });

    this.logger?.logEvent({
      level: 'WARN',
      service: 'projectmind',
      component: 'workload-limiter',
      operation: 'acquire_permit',
      message: `Workload rejected for workspace '${workspaceId}': ${reason}`,
      workspaceId,
      outcome: 'FAILURE',
    });
  }

  public getHealthDiagnostic(): ConcurrencyHealthDiagnostic {
    const totalAttempts = this.totalAcquisitions + this.totalContentions;
    const contentionRate = totalAttempts > 0 ? this.totalContentions / totalAttempts : 0;

    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
    let message = 'Concurrency subsystem healthy';

    if (totalAttempts >= 10) {
      if (contentionRate > 0.6) {
        status = 'UNHEALTHY';
        message = `Severe lock contention detected: ${(contentionRate * 100).toFixed(1)}% contention rate`;
      } else if (contentionRate > 0.3) {
        status = 'DEGRADED';
        message = `Elevated lock contention: ${(contentionRate * 100).toFixed(1)}% contention rate`;
      }
    }

    return {
      status,
      activeLocks: this.currentActiveLocks,
      contentions: this.totalContentions,
      conflicts: this.totalConflicts,
      coalescedRequests: this.totalCoalesced,
      staleResults: this.totalStale,
      contentionRate,
      message,
    };
  }
}
