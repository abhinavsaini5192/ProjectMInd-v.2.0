import type { IMetricsRegistry } from '../metrics/MetricTypes.js';
import type { ObservabilityLogger } from '../logging/ObservabilityLogger.js';
import type { IAlertManager } from '../operations/AlertTypes.js';
import { CORE_METRIC_NAMES } from '../metrics/CoreMetrics.js';

export class SecurityTelemetry {
  private failedAuthCount = 0;
  private readonly suspiciousThreshold: number;

  constructor(
    private readonly metricsRegistry: IMetricsRegistry,
    private readonly logger: ObservabilityLogger,
    private readonly alertManager: IAlertManager,
    suspiciousThreshold: number = 5
  ) {
    this.suspiciousThreshold = suspiciousThreshold;
  }

  public recordAuthFailure(reason: string, principalReference?: string): void {
    this.metricsRegistry.counter(CORE_METRIC_NAMES.SECURITY_AUTH_FAILURES_TOTAL).increment(1);
    this.failedAuthCount++;

    this.logger.logEvent({
      level: 'WARN',
      service: 'projectmind',
      component: 'security-auth',
      operation: 'authenticate',
      message: `Authentication failure: ${reason}`,
      principalReference,
      outcome: 'FAILURE',
      metadata: { reason },
    });

    if (this.failedAuthCount >= this.suspiciousThreshold) {
      this.alertManager.createAlert(
        'WARNING',
        'SECURITY',
        'security-auth',
        'SUSPICIOUS_AUTH_FAILURES',
        `High number of authentication failures detected (${this.failedAuthCount} attempts)`
      );
    }
  }

  public recordAuthorizationDenial(action: string, resourceType: string, principalReference?: string): void {
    this.metricsRegistry.counter(CORE_METRIC_NAMES.SECURITY_AUTHZ_DENIALS_TOTAL).increment(1, {
      action: action.substring(0, 32),
      resource: resourceType.substring(0, 32),
    });

    this.logger.logEvent({
      level: 'WARN',
      service: 'projectmind',
      component: 'security-authz',
      operation: 'authorize',
      message: `Authorization denied for action '${action}' on resource '${resourceType}'`,
      principalReference,
      outcome: 'FAILURE',
      metadata: { action, resourceType },
    });
  }

  public recordScopeViolation(requiredScope: string, actualScopes: readonly string[]): void {
    this.metricsRegistry.counter(CORE_METRIC_NAMES.SECURITY_SCOPE_VIOLATIONS_TOTAL).increment(1);

    this.logger.logEvent({
      level: 'WARN',
      service: 'projectmind',
      component: 'security-scope',
      operation: 'validate_scope',
      message: `Security scope violation: required '${requiredScope}' not satisfied`,
      outcome: 'FAILURE',
    });
  }
}
