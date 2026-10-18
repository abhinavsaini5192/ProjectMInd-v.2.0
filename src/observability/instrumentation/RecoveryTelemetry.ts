import type { IMetricsRegistry } from '../metrics/MetricTypes.js';
import type { ITracer } from '../tracing/TraceTypes.js';
import type { ObservabilityLogger } from '../logging/ObservabilityLogger.js';
import { CORE_METRIC_NAMES } from '../metrics/CoreMetrics.js';

export class RecoveryTelemetry {
  constructor(
    private readonly metricsRegistry: IMetricsRegistry,
    private readonly tracer: ITracer,
    private readonly logger: ObservabilityLogger
  ) {}

  public recordBackupSuccess(
    backupId: string,
    durationMs: number,
    sizeBytes: number,
    scope: string = 'full'
  ): void {
    this.metricsRegistry.counter(CORE_METRIC_NAMES.BACKUP_OPERATIONS_TOTAL).increment(1, {
      status: 'success',
      scope: scope.substring(0, 32),
    });
    this.metricsRegistry.histogram(CORE_METRIC_NAMES.BACKUP_DURATION_MS).record(durationMs);
    this.metricsRegistry.gauge(CORE_METRIC_NAMES.BACKUP_SIZE_BYTES).set(sizeBytes);
    this.metricsRegistry.gauge(CORE_METRIC_NAMES.BACKUP_LAST_TIMESTAMP).set(Math.floor(Date.now() / 1000));

    this.logger.logEvent({
      level: 'INFO',
      service: 'projectmind',
      component: 'database-backup',
      operation: 'create_backup',
      message: `Database backup '${backupId}' created successfully in ${durationMs}ms (size: ${sizeBytes} bytes, scope: ${scope})`,
      durationMs,
      outcome: 'SUCCESS',
      metadata: { backupId, sizeBytes, scope },
    });
  }

  public recordBackupFailure(scope: string, reason: string, durationMs: number): void {
    this.metricsRegistry.counter(CORE_METRIC_NAMES.BACKUP_OPERATIONS_TOTAL).increment(1, {
      status: 'failure',
      scope: scope.substring(0, 32),
    });

    this.logger.logEvent({
      level: 'ERROR',
      service: 'projectmind',
      component: 'database-backup',
      operation: 'create_backup',
      message: `Database backup failed for scope '${scope}' after ${durationMs}ms: ${reason}`,
      durationMs,
      outcome: 'FAILURE',
      metadata: { scope, reason },
    });
  }

  public recordBackupVerified(backupId: string, isValid: boolean): void {
    if (!isValid) {
      this.metricsRegistry.counter(CORE_METRIC_NAMES.BACKUP_VERIFICATION_FAILURES_TOTAL).increment(1);
    }

    this.logger.logEvent({
      level: isValid ? 'INFO' : 'ERROR',
      service: 'projectmind',
      component: 'database-backup',
      operation: 'verify_backup',
      message: `Database backup '${backupId}' verification ${isValid ? 'PASSED' : 'FAILED'}`,
      outcome: isValid ? 'SUCCESS' : 'FAILURE',
      metadata: { backupId, isValid },
    });
  }

  public recordRestoreSuccess(
    backupId: string,
    durationMs: number,
    entityCount: number,
    targetType: string = 'isolated'
  ): void {
    this.metricsRegistry.counter(CORE_METRIC_NAMES.RESTORE_OPERATIONS_TOTAL).increment(1, {
      status: 'success',
      target: targetType.substring(0, 32),
    });
    this.metricsRegistry.histogram(CORE_METRIC_NAMES.RESTORE_DURATION_MS).record(durationMs);

    this.logger.logEvent({
      level: 'WARN',
      service: 'projectmind',
      component: 'database-restore',
      operation: 'execute_restore',
      message: `Database restored from backup '${backupId}' in ${durationMs}ms (${entityCount} entities validated, target: ${targetType})`,
      durationMs,
      outcome: 'SUCCESS',
      metadata: { backupId, entityCount, targetType },
    });
  }

  public recordRestoreFailure(backupId: string, reason: string, durationMs: number): void {
    this.metricsRegistry.counter(CORE_METRIC_NAMES.RESTORE_OPERATIONS_TOTAL).increment(1, {
      status: 'failure',
    });

    this.logger.logEvent({
      level: 'FATAL',
      service: 'projectmind',
      component: 'database-restore',
      operation: 'execute_restore',
      message: `Database restore FAILED for backup '${backupId}' after ${durationMs}ms: ${reason}`,
      durationMs,
      outcome: 'FAILURE',
      metadata: { backupId, reason },
    });
  }

  public updateBackupsRetained(count: number): void {
    this.metricsRegistry.gauge(CORE_METRIC_NAMES.BACKUPS_RETAINED_COUNT).set(count);
  }
}
