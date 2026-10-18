import { describe, it, expect, beforeEach } from 'vitest';
import {
  AlertManager,
  OperationalEventBus,
  type AlertPolicy,
} from '../../src/observability/index.js';
import type { IEventBus, EventHandler } from '../../src/workspace/interfaces/IEventBus.js';

class MockEventBus implements IEventBus {
  public published: Array<{ eventName: string; payload: any }> = [];
  private handlers = new Map<string, EventHandler[]>();

  publish<T>(eventName: string, payload: T): void {
    this.published.push({ eventName, payload });
    const list = this.handlers.get(eventName) ?? [];
    for (const h of list) {
      h({
        name: eventName,
        payload,
        timestamp: new Date().toISOString(),
      });
    }
  }

  subscribe<T>(eventName: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(eventName) ?? [];
    list.push(handler);
    this.handlers.set(eventName, list);
  }

  unsubscribe<T>(eventName: string, handler: EventHandler<T>): void {
    const list = this.handlers.get(eventName) ?? [];
    this.handlers.set(eventName, list.filter((h) => h !== handler));
  }
}

describe('Observability - Alerting Subsystem & Operational Events', () => {
  let mockEventBus: MockEventBus;
  let operationalEventBus: OperationalEventBus;
  let alertManager: AlertManager;

  beforeEach(() => {
    mockEventBus = new MockEventBus();
    operationalEventBus = new OperationalEventBus(mockEventBus);
    alertManager = new AlertManager({
      operationalEventBus,
      maxAlerts: 10,
    });
  });

  it('creates and manages alert lifecycle (OPEN -> ACKNOWLEDGED -> RESOLVED)', () => {
    const alert = alertManager.createAlert(
      'WARNING',
      'STORAGE',
      'sqlite-engine',
      'HIGH_WRITE_LATENCY',
      'Storage write operations exceeding threshold'
    );

    expect(alert.alertId).toBeDefined();
    expect(alert.status).toBe('OPEN');
    expect(alertManager.getActiveAlerts()).toHaveLength(1);

    // Acknowledge
    const acked = alertManager.acknowledgeAlert(alert.alertId);
    expect(acked).toBe(true);
    expect(alertManager.getActiveAlerts()[0]!.status).toBe('ACKNOWLEDGED');
    expect(alertManager.getActiveAlerts()[0]!.acknowledgedAt).toBeDefined();

    // Resolve
    const resolved = alertManager.resolveAlert(alert.alertId);
    expect(resolved).toBe(true);
    expect(alertManager.getActiveAlerts()).toHaveLength(0);
    expect(alertManager.getAllAlerts()[0]!.status).toBe('RESOLVED');
    expect(alertManager.getAllAlerts()[0]!.resolvedAt).toBeDefined();
  });

  it('deduplicates open alerts with identical source, category, and condition', () => {
    const alert1 = alertManager.createAlert(
      'ERROR',
      'API',
      'http-gateway',
      'HIGH_5XX_RATE',
      '5xx error spike detected'
    );

    const alert2 = alertManager.createAlert(
      'ERROR',
      'API',
      'http-gateway',
      'HIGH_5XX_RATE',
      '5xx error spike detected again'
    );

    expect(alert1.alertId).toBe(alert2.alertId);
    expect(alertManager.getActiveAlerts()).toHaveLength(1);
  });

  it('emits operational events for CRITICAL alert open and resolve', () => {
    const alert = alertManager.createAlert(
      'CRITICAL',
      'SYSTEM',
      'database-cluster',
      'DB_UNAVAILABLE',
      'Primary database connection lost'
    );

    expect(mockEventBus.published.some((p) => p.eventName === 'operational.runtime_degraded')).toBe(true);

    alertManager.resolveAlert(alert.alertId);
    expect(mockEventBus.published.some((p) => p.eventName === 'operational.recovery_completed')).toBe(true);
  });

  it('evaluates alert policies and respects cooldown periods', () => {
    const highLatencyPolicy: AlertPolicy = {
      policyId: 'policy-high-latency',
      name: 'High Context Generation Latency',
      category: 'API',
      severity: 'WARNING',
      conditionDescription: 'latency_ms > 2000',
      cooldownMs: 5000,
      evaluate: (ctx) => (ctx.metricValue ?? 0) > 2000,
    };

    alertManager.registerPolicy(highLatencyPolicy);

    // 1st evaluation below threshold: no alert
    const r1 = alertManager.evaluatePolicies({
      category: 'API',
      source: 'context-orchestrator',
      metricValue: 1500,
    });
    expect(r1).toHaveLength(0);

    // 2nd evaluation above threshold: alert triggered!
    const r2 = alertManager.evaluatePolicies({
      category: 'API',
      source: 'context-orchestrator',
      metricValue: 2500,
    });
    expect(r2).toHaveLength(1);
    expect(r2[0]!.condition).toBe('latency_ms > 2000');

    // 3rd evaluation immediate: cooldown suppresses trigger
    const r3 = alertManager.evaluatePolicies({
      category: 'API',
      source: 'context-orchestrator',
      metricValue: 2800,
    });
    expect(r3).toHaveLength(0);
  });
});
