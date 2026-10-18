import { ObservabilityLogger } from './logging/ObservabilityLogger.js';
import { defaultMetricsRegistry, MetricsRegistry } from './metrics/MetricsRegistry.js';
import { defaultTracer, Tracer } from './tracing/Tracer.js';
import { defaultHealthManager, HealthManager } from './health/HealthManager.js';
import { defaultDiagnosticManager, DiagnosticManager } from './diagnostics/DiagnosticManager.js';
import { defaultAlertManager, AlertManager } from './operations/AlertManager.js';

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  timestamp: number;
  message: string;
  metadata?: any;
}

/**
 * Modernized ObservabilityEngine providing backward compatibility while delegating
 * directly to canonical Phase 8.5 subsystems.
 */
export class ObservabilityEngine {
  public readonly logger: ObservabilityLogger;
  public readonly metrics: MetricsRegistry;
  public readonly tracer: Tracer;
  public readonly health: HealthManager;
  public readonly diagnostics: DiagnosticManager;
  public readonly alerts: AlertManager;

  private readonly legacyLogs: LogEntry[] = [];

  constructor(
    logger?: ObservabilityLogger,
    metrics?: MetricsRegistry,
    tracer?: Tracer,
    health?: HealthManager,
    diagnostics?: DiagnosticManager,
    alerts?: AlertManager
  ) {
    this.logger = logger ?? new ObservabilityLogger();
    this.metrics = metrics ?? defaultMetricsRegistry;
    this.tracer = tracer ?? defaultTracer;
    this.health = health ?? defaultHealthManager;
    this.diagnostics = diagnostics ?? defaultDiagnosticManager;
    this.alerts = alerts ?? defaultAlertManager;
  }

  public log(level: 'info' | 'warn' | 'error' | 'debug', message: string, metadata?: any): void {
    const entry: LogEntry = { level, timestamp: Date.now(), message, metadata };
    this.legacyLogs.push(entry);

    const severityMap: Record<string, 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'> = {
      debug: 'DEBUG',
      info: 'INFO',
      warn: 'WARN',
      error: 'ERROR',
    };

    const severity = severityMap[level] ?? 'INFO';
    this.logger.logEvent({
      level: severity,
      service: 'projectmind',
      component: 'observability-engine',
      operation: 'log',
      message,
      metadata: typeof metadata === 'object' && metadata !== null ? metadata : { raw: metadata },
    });
  }

  public recordMetric(name: string, value: number): void {
    this.metrics.gauge(name).set(value);
  }

  public trace(event: string, startMs: number): void {
    const duration = Date.now() - startMs;
    this.metrics.histogram(`${event}_latency`).record(duration);
  }

  public async getHealth(): Promise<{ status: string; uptime: number }> {
    const health = await this.health.getHealth();
    const liveness = this.health.getLiveness();
    return {
      status: health.status.toLowerCase(),
      uptime: Math.round(liveness.uptimeMs / 1000),
    };
  }

  public getLegacyLogs(): readonly LogEntry[] {
    return [...this.legacyLogs];
  }
}
