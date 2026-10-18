import { randomUUID } from 'node:crypto';
import type {
  Alert,
  AlertCategory,
  AlertEvaluationContext,
  AlertPolicy,
  AlertSeverity,
  IAlertManager,
} from './AlertTypes.js';
import { CorrelationContext } from '../correlation/CorrelationContext.js';
import { defaultLogSanitizer, LogSanitizer } from '../logging/LogSanitizer.js';
import type { OperationalEventBus } from './OperationalEventBus.js';

export interface AlertManagerOptions {
  readonly maxAlerts?: number | undefined;
  readonly sanitizer?: LogSanitizer | undefined;
  readonly operationalEventBus?: OperationalEventBus | undefined;
}

export class AlertManager implements IAlertManager {
  private readonly policies = new Map<string, AlertPolicy>();
  private readonly policyLastTriggered = new Map<string, number>();
  private readonly alerts = new Map<string, Alert>();
  private readonly maxAlerts: number;
  private readonly sanitizer: LogSanitizer;
  private readonly eventBus?: OperationalEventBus | undefined;

  constructor(options: AlertManagerOptions = {}) {
    this.maxAlerts = options.maxAlerts ?? 500;
    this.sanitizer = options.sanitizer ?? defaultLogSanitizer;
    this.eventBus = options.operationalEventBus;
  }

  public registerPolicy(policy: AlertPolicy): void {
    this.policies.set(policy.policyId, policy);
  }

  public evaluatePolicies(context: AlertEvaluationContext): readonly Alert[] {
    const triggered: Alert[] = [];
    const now = Date.now();

    for (const policy of this.policies.values()) {
      if (policy.category !== context.category) {
        continue;
      }

      // Check cooldown
      const lastTriggered = this.policyLastTriggered.get(policy.policyId) ?? 0;
      const cooldown = policy.cooldownMs ?? 60000;
      if (now - lastTriggered < cooldown) {
        continue;
      }

      try {
        if (policy.evaluate(context)) {
          this.policyLastTriggered.set(policy.policyId, now);

          const alert = this.createAlert(
            policy.severity,
            policy.category,
            context.source,
            policy.conditionDescription,
            context.message ?? `Alert policy '${policy.name}' condition triggered`,
            context.metadata
          );
          triggered.push(alert);
        }
      } catch {
        // Telemetry failure isolation
      }
    }

    return triggered;
  }

  public createAlert(
    severity: AlertSeverity,
    category: AlertCategory,
    source: string,
    condition: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Alert {
    const ambient = CorrelationContext.current();

    // Deduplication check: check if an identical open alert already exists
    for (const existing of this.alerts.values()) {
      if (
        (existing.status === 'OPEN' || existing.status === 'ACKNOWLEDGED') &&
        existing.source === source &&
        existing.condition === condition &&
        existing.category === category
      ) {
        return existing;
      }
    }

    const alertId = randomUUID();
    const sanitizedMetadata = metadata
      ? (this.sanitizer.sanitize(metadata) as Record<string, unknown>)
      : undefined;

    const alert: Alert = {
      alertId,
      severity,
      category,
      source,
      condition,
      timestamp: new Date().toISOString(),
      status: 'OPEN',
      correlationId: ambient?.correlationId,
      message: this.sanitizer.sanitizeString(message),
      metadata: sanitizedMetadata,
    };

    if (this.alerts.size >= this.maxAlerts) {
      const firstKey = this.alerts.keys().next().value;
      if (firstKey) this.alerts.delete(firstKey);
    }

    this.alerts.set(alertId, alert);

    if (severity === 'CRITICAL' && this.eventBus) {
      this.eventBus.emit(
        'RUNTIME_DEGRADED',
        source,
        `Critical alert opened: ${alert.message}`,
        { alertId, condition }
      );
    }

    return alert;
  }

  public acknowledgeAlert(alertId: string): boolean {
    const existing = this.alerts.get(alertId);
    if (!existing || existing.status !== 'OPEN') return false;

    this.alerts.set(alertId, {
      ...existing,
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date().toISOString(),
    });
    return true;
  }

  public resolveAlert(alertId: string): boolean {
    const existing = this.alerts.get(alertId);
    if (!existing || existing.status === 'RESOLVED') return false;

    this.alerts.set(alertId, {
      ...existing,
      status: 'RESOLVED',
      resolvedAt: new Date().toISOString(),
    });

    if (existing.severity === 'CRITICAL' && this.eventBus) {
      this.eventBus.emit(
        'RECOVERY_COMPLETED',
        existing.source,
        `Critical alert resolved: ${existing.message}`,
        { alertId }
      );
    }

    return true;
  }

  public suppressAlert(alertId: string): boolean {
    const existing = this.alerts.get(alertId);
    if (!existing) return false;

    this.alerts.set(alertId, {
      ...existing,
      status: 'SUPPRESSED',
    });
    return true;
  }

  public getActiveAlerts(): readonly Alert[] {
    return Array.from(this.alerts.values()).filter(
      (a) => a.status === 'OPEN' || a.status === 'ACKNOWLEDGED'
    );
  }

  public getAllAlerts(): readonly Alert[] {
    return Array.from(this.alerts.values());
  }

  public clear(): void {
    this.alerts.clear();
    this.policies.clear();
    this.policyLastTriggered.clear();
  }
}

export const defaultAlertManager = new AlertManager();
