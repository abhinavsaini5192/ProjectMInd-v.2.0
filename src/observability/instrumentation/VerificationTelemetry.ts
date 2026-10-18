import type { IMetricsRegistry } from '../metrics/MetricTypes.js';
import type { ITracer } from '../tracing/TraceTypes.js';
import type { ObservabilityLogger } from '../logging/ObservabilityLogger.js';
import { CORE_METRIC_NAMES } from '../metrics/CoreMetrics.js';

export interface VerificationTelemetryParams {
  readonly ruleId?: string | undefined;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly violationsCount?: number | undefined;
}

export class VerificationTelemetry {
  constructor(
    private readonly metricsRegistry: IMetricsRegistry,
    private readonly tracer: ITracer,
    private readonly logger: ObservabilityLogger
  ) {}

  public recordVerificationRun(params: VerificationTelemetryParams): void {
    const outcome = params.passed ? 'PASSED' : 'FAILED';
    const rule = (params.ruleId ?? 'all').substring(0, 32);

    this.metricsRegistry.counter(CORE_METRIC_NAMES.VERIFICATION_RUNS_TOTAL).increment(1, {
      rule,
      outcome,
    });

    this.metricsRegistry.counter(CORE_METRIC_NAMES.VERIFICATION_RESULTS_TOTAL).increment(1, {
      outcome,
    });

    this.metricsRegistry.histogram(CORE_METRIC_NAMES.VERIFICATION_DURATION_MS).record(params.durationMs, {
      rule,
    });

    this.logger.logEvent({
      level: params.passed ? 'INFO' : 'WARN',
      service: 'projectmind',
      component: 'verification-subsystem',
      operation: 'verify',
      message: `Verification ${outcome} in ${params.durationMs}ms [rule=${rule}, violations=${params.violationsCount ?? 0}]`,
      durationMs: params.durationMs,
      outcome: params.passed ? 'SUCCESS' : 'FAILURE',
      metadata: {
        rule,
        passed: params.passed,
        violationsCount: params.violationsCount,
      },
    });
  }
}
