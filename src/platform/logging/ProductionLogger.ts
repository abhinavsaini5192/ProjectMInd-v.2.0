import type { ILogger, LogEntry, LogSeverity } from '../../workspace/interfaces/ILogger.js';
import type { EnvironmentName } from '../config/PlatformConfig.js';
import { LogRedactor } from './LogRedactor.js';
import { CorrelationContext } from '../../observability/correlation/CorrelationContext.js';
import { defaultLogSanitizer } from '../../observability/logging/LogSanitizer.js';

export interface ProductionLoggerOptions {
  readonly minLevel?: LogSeverity | undefined;
  readonly serviceName?: string | undefined;
  readonly serviceVersion?: string | undefined;
  readonly instanceId?: string | undefined;
  readonly role?: string | undefined;
  readonly env?: EnvironmentName | undefined;
  readonly format?: 'json' | 'pretty' | undefined;
  readonly sink?: ((line: string, entry: LogEntry) => void) | undefined;
  readonly redactionEnabled?: boolean | undefined;
}

export class ProductionLogger implements ILogger {
  private static readonly SEVERITY_LEVELS: Record<LogSeverity, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4,
  };

  private readonly minLevel: LogSeverity;
  private readonly serviceName: string;
  private readonly serviceVersion: string;
  private readonly instanceId?: string | undefined;
  private readonly role?: string | undefined;
  private readonly env: EnvironmentName;
  private readonly format: 'json' | 'pretty';
  private readonly sink?: ((line: string, entry: LogEntry) => void) | undefined;
  private readonly redactionEnabled: boolean;
  private readonly inMemoryBuffer: LogEntry[] = [];
  private readonly maxBufferSize: number = 200;

  constructor(options: ProductionLoggerOptions = {}) {
    this.minLevel = options.minLevel ?? (options.env === 'production' ? 'INFO' : 'DEBUG');
    this.serviceName = options.serviceName ?? 'projectmind';
    this.serviceVersion = options.serviceVersion ?? '1.0.0';
    this.instanceId = options.instanceId;
    this.role = options.role;
    this.env = options.env ?? 'development';
    this.format = options.format ?? (options.env === 'development' ? 'pretty' : 'json');
    this.sink = options.sink;
    this.redactionEnabled = options.redactionEnabled ?? true;
  }

  public debug(entry: Omit<LogEntry, 'severity' | 'timestamp'>): void {
    this.writeLog('DEBUG', entry);
  }

  public info(entry: Omit<LogEntry, 'severity' | 'timestamp'>): void {
    this.writeLog('INFO', entry);
  }

  public warn(entry: Omit<LogEntry, 'severity' | 'timestamp'>): void {
    this.writeLog('WARN', entry);
  }

  public error(entry: Omit<LogEntry, 'severity' | 'timestamp'>): void {
    this.writeLog('ERROR', entry);
  }

  public fatal(entry: Omit<LogEntry, 'severity' | 'timestamp'>): void {
    this.writeLog('FATAL', entry);
  }

  public getBufferedEntries(): readonly LogEntry[] {
    return [...this.inMemoryBuffer];
  }

  public clearBuffer(): void {
    this.inMemoryBuffer.length = 0;
  }

  private writeLog(severity: LogSeverity, entryData: Omit<LogEntry, 'severity' | 'timestamp'>): void {
    if (ProductionLogger.SEVERITY_LEVELS[severity] < ProductionLogger.SEVERITY_LEVELS[this.minLevel]) {
      return;
    }

    const ambient = CorrelationContext.current();

    const processedDetails = this.redactionEnabled && entryData.details
      ? LogRedactor.redactEntry(entryData.details)
      : entryData.details;

    const sanitizedMessage = defaultLogSanitizer.sanitizeLogMessage(entryData.message);

    const fullEntry: LogEntry = {
      component: entryData.component,
      operation: entryData.operation,
      message: sanitizedMessage,
      severity,
      timestamp: new Date().toISOString(),
      correlationId: entryData.correlationId ?? ambient?.correlationId,
      ...(entryData.repositoryId !== undefined || ambient?.repositoryId ? { repositoryId: entryData.repositoryId ?? ambient?.repositoryId } : {}),
      ...(entryData.workspaceId !== undefined || ambient?.workspaceId ? { workspaceId: entryData.workspaceId ?? ambient?.workspaceId } : {}),
      ...(entryData.durationMs !== undefined ? { durationMs: entryData.durationMs } : {}),
      ...(processedDetails !== undefined ? { details: processedDetails } : {}),
    };

    // Store in internal buffer for diagnostics/testing
    this.inMemoryBuffer.push(fullEntry);
    if (this.inMemoryBuffer.length > this.maxBufferSize) {
      this.inMemoryBuffer.shift();
    }

    const outputLine = this.formatLine(fullEntry, ambient);

    if (this.sink) {
      this.sink(outputLine, fullEntry);
      return;
    }

    if (severity === 'ERROR' || severity === 'FATAL') {
      console.error(outputLine);
    } else if (severity === 'WARN') {
      console.warn(outputLine);
    } else {
      console.log(outputLine);
    }
  }

  private formatLine(entry: LogEntry, ambient?: ReturnType<typeof CorrelationContext.current>): string {
    if (this.format === 'json') {
      return JSON.stringify({
        service: this.serviceName,
        version: this.serviceVersion,
        env: this.env,
        ...(this.instanceId || ambient?.instanceId ? { instanceId: this.instanceId ?? ambient?.instanceId } : {}),
        ...(this.role || ambient?.role ? { role: this.role ?? ambient?.role } : {}),
        ...(ambient?.traceId ? { traceId: ambient.traceId } : {}),
        ...(ambient?.spanId ? { spanId: ambient.spanId } : {}),
        ...(ambient?.requestId ? { requestId: ambient.requestId } : {}),
        ...(ambient?.jobId ? { jobId: ambient.jobId } : {}),
        ...entry,
      });
    }

    const durationStr = entry.durationMs !== undefined ? ` [${entry.durationMs}ms]` : '';
    const corrStr = entry.correlationId ? ` (corr=${entry.correlationId})` : '';
    const detailsStr = entry.details ? ` ${JSON.stringify(entry.details)}` : '';
    return `[${entry.timestamp}] [${entry.severity}] [${entry.component}:${entry.operation}] ${entry.message}${durationStr}${corrStr}${detailsStr}`;
  }
}

