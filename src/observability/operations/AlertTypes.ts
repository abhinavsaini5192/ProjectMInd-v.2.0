export type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED';

export type AlertCategory =
  | 'SYSTEM'
  | 'SECURITY'
  | 'STORAGE'
  | 'API'
  | 'AGENT'
  | 'DEPENDENCY'
  | 'KNOWLEDGE'
  | 'VERIFICATION';

export interface Alert {
  readonly alertId: string;
  readonly severity: AlertSeverity;
  readonly category: AlertCategory;
  readonly source: string;
  readonly condition: string;
  readonly timestamp: string;
  readonly status: AlertStatus;
  readonly correlationId?: string | undefined;
  readonly message: string;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
  readonly resolvedAt?: string | undefined;
  readonly acknowledgedAt?: string | undefined;
}

export interface AlertEvaluationContext {
  readonly category: AlertCategory;
  readonly source: string;
  readonly metricName?: string | undefined;
  readonly metricValue?: number | undefined;
  readonly threshold?: number | undefined;
  readonly errorCount?: number | undefined;
  readonly failureRate?: number | undefined;
  readonly correlationId?: string | undefined;
  readonly message?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface AlertPolicy {
  readonly policyId: string;
  readonly name: string;
  readonly category: AlertCategory;
  readonly severity: AlertSeverity;
  readonly conditionDescription: string;
  readonly cooldownMs?: number | undefined;
  evaluate(context: AlertEvaluationContext): boolean;
}

export interface IAlertManager {
  registerPolicy(policy: AlertPolicy): void;
  evaluatePolicies(context: AlertEvaluationContext): readonly Alert[];
  createAlert(
    severity: AlertSeverity,
    category: AlertCategory,
    source: string,
    condition: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Alert;
  acknowledgeAlert(alertId: string): boolean;
  resolveAlert(alertId: string): boolean;
  suppressAlert(alertId: string): boolean;
  getActiveAlerts(): readonly Alert[];
  getAllAlerts(): readonly Alert[];
  clear(): void;
}

export const IAlertManagerToken = Symbol('IAlertManager');
