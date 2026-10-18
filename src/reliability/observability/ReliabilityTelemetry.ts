import type { IMetricsRegistry } from '../../observability/metrics/MetricTypes.js';
import type { ITracer } from '../../observability/tracing/TraceTypes.js';
import type { ObservabilityLogger } from '../../observability/logging/ObservabilityLogger.js';
import type { FailureRecord } from '../models/FailureClassification.js';
import type { RecoveryOperation } from '../models/RecoveryState.js';

export const RELIABILITY_METRIC_NAMES = {
  FAILURES_TOTAL: 'reliability_failures_total',
  CIRCUIT_STATE: 'reliability_circuit_state',
  CIRCUIT_TRIPS_TOTAL: 'reliability_circuit_trips_total',
  RECOVERY_OPERATIONS_TOTAL: 'reliability_recovery_operations_total',
  RECOVERY_DURATION_MS: 'reliability_recovery_duration_ms',
  DEGRADED_MODES_ACTIVE: 'reliability_degraded_modes_active',
} as const;

export type ReliabilityHealthState = 'HEALTHY' | 'DEGRADED' | 'RECOVERING' | 'UNAVAILABLE';

export interface ReliabilityHealthReport {
  readonly state: ReliabilityHealthState;
  readonly activeDegradations: readonly string[];
  readonly activeRecoveryOperation?: string | undefined;
  readonly openCircuits: readonly string[];
  readonly message: string;
}

export class ReliabilityTelemetry {
  private readonly degradedComponents = new Set<string>();
  private readonly openCircuits = new Set<string>();
  private activeRecovery?: string | undefined;

  constructor(
    private readonly metrics?: IMetricsRegistry | undefined,
    private readonly tracer?: ITracer | undefined,
    private readonly logger?: ObservabilityLogger | undefined
  ) {}

  public recordFailure(failure: FailureRecord): void {
    this.metrics?.counter(RELIABILITY_METRIC_NAMES.FAILURES_TOTAL).increment(1, {
      category: failure.category,
      severity: failure.severity,
    });

    this.logger?.logEvent({
      level: failure.severity === 'CRITICAL' ? 'FATAL' : failure.severity === 'HIGH' ? 'ERROR' : 'WARN',
      service: 'projectmind',
      component: 'reliability',
      operation: failure.operation ?? 'unspecified_operation',
      message: `[${failure.category}] ${failure.message}`,
      outcome: 'FAILURE',
      metadata: {
        failureId: failure.failureId,
        errorCode: failure.errorCode,
        resource: failure.resource,
        retryable: failure.retryable,
      },
    });
  }

  public recordCircuitState(name: string, state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'): void {
    const numericState = state === 'CLOSED' ? 0 : state === 'HALF_OPEN' ? 1 : 2;
    this.metrics?.gauge(RELIABILITY_METRIC_NAMES.CIRCUIT_STATE).set(numericState, { name });

    if (state === 'OPEN') {
      this.openCircuits.add(name);
      this.metrics?.counter(RELIABILITY_METRIC_NAMES.CIRCUIT_TRIPS_TOTAL).increment(1, { name });
      this.logger?.logEvent({
        level: 'WARN',
        service: 'projectmind',
        component: 'circuit-breaker',
        operation: 'trip_circuit',
        message: `Circuit breaker '${name}' tripped to OPEN`,
        outcome: 'FAILURE',
        metadata: { circuitName: name },
      });
    } else {
      this.openCircuits.delete(name);
    }
  }

  public recordRecoveryOperation(op: RecoveryOperation): void {
    if (op.status === 'IN_PROGRESS') {
      this.activeRecovery = op.operationId;
    } else {
      if (this.activeRecovery === op.operationId) {
        this.activeRecovery = undefined;
      }
      const durationMs = (op.completedAt ?? Date.now()) - op.startedAt;
      this.metrics?.histogram(RELIABILITY_METRIC_NAMES.RECOVERY_DURATION_MS).record(durationMs, {
        type: op.type,
      });
    }

    this.metrics?.counter(RELIABILITY_METRIC_NAMES.RECOVERY_OPERATIONS_TOTAL).increment(1, {
      type: op.type,
      status: op.status,
    });

    this.logger?.logEvent({
      level: op.status === 'FAILED' ? 'ERROR' : 'INFO',
      service: 'projectmind',
      component: 'recovery-manager',
      operation: 'execute_recovery',
      message: `Recovery operation '${op.operationId}' [${op.type}] status: ${op.status}`,
      correlationId: op.correlationId,
      outcome: op.status === 'RECOVERED' ? 'SUCCESS' : 'FAILURE',
      metadata: {
        operationId: op.operationId,
        type: op.type,
        status: op.status,
      },
    });
  }

  public recordDegradation(component: string, isDegraded: boolean): void {
    if (isDegraded) {
      this.degradedComponents.add(component);
    } else {
      this.degradedComponents.delete(component);
    }

    this.metrics?.gauge(RELIABILITY_METRIC_NAMES.DEGRADED_MODES_ACTIVE).set(
      this.degradedComponents.size,
      { component }
    );
  }

  public getHealthReport(isStorageDown: boolean = false): ReliabilityHealthReport {
    let state: ReliabilityHealthState = 'HEALTHY';
    let message = 'Reliability systems nominal';

    if (isStorageDown) {
      state = 'UNAVAILABLE';
      message = 'Critical primary storage is offline';
    } else if (this.activeRecovery) {
      state = 'RECOVERING';
      message = `Active recovery operation in progress: ${this.activeRecovery}`;
    } else if (this.degradedComponents.size > 0 || this.openCircuits.size > 0) {
      state = 'DEGRADED';
      const items = [...this.degradedComponents, ...this.openCircuits];
      message = `Operating in degraded mode with issues in: ${items.join(', ')}`;
    }

    return {
      state,
      activeDegradations: Array.from(this.degradedComponents),
      activeRecoveryOperation: this.activeRecovery,
      openCircuits: Array.from(this.openCircuits),
      message,
    };
  }
}
