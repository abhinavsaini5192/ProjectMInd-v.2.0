import { randomUUID } from 'node:crypto';
import type { ILogger, LogEntry, LogSeverity } from '../../workspace/interfaces/ILogger.js';
import type { LogEvent, LogLevel } from './LogEvent.js';
import { LogSanitizer, defaultLogSanitizer } from './LogSanitizer.js';
import { CorrelationContext } from '../correlation/CorrelationContext.js';

export type LogSinkFn = (line: string, event: LogEvent) => void;

export interface ObservabilityLoggerOptions {
  readonly minLevel?: LogSeverity | undefined;
  readonly serviceName?: string | undefined;
  readonly instanceId?: string | undefined;
  readonly role?: string | undefined;
  readonly environment?: string | undefined;
  readonly defaultComponent?: string | undefined;
  readonly format?: 'json' | 'pretty' | undefined;
  readonly sink?: LogSinkFn | undefined;
  readonly sanitizer?: LogSanitizer | undefined;
  readonly maxBufferSize?: number | undefined;
}

export class ObservabilityLogger implements ILogger {
  private static readonly SEVERITY_LEVELS: Record<LogSeverity, number> = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4,
  };

  private readonly minLevel: LogSeverity;
  private readonly serviceName: string;
  private readonly instanceId?: string | undefined;
  private readonly role?: string | undefined;
  private readonly environment?: string | undefined;
  private readonly defaultComponent: string;
  private readonly format: 'json' | 'pretty';
  private readonly sink?: LogSinkFn | undefined;
  private readonly sanitizer: LogSanitizer;
  private readonly maxBufferSize: number;
  private readonly inMemoryBuffer: LogEvent[] = [];

  constructor(options: ObservabilityLoggerOptions = {}) {
    this.minLevel = options.minLevel ?? 'INFO';
    this.serviceName = options.serviceName ?? 'projectmind';
    this.instanceId = options.instanceId;
    this.role = options.role;
    this.environment = options.environment;
    this.defaultComponent = options.defaultComponent ?? 'system';
    this.format = options.format ?? 'json';
    this.sink = options.sink;
    this.sanitizer = options.sanitizer ?? defaultLogSanitizer;
    this.maxBufferSize = options.maxBufferSize ?? 500;
  }

  // --- ILogger interface methods ---

  public debug(entry: Omit<LogEntry, 'severity' | 'timestamp'>): void {
    this.logFromEntry('DEBUG', entry);
  }

  public info(entry: Omit<LogEntry, 'severity' | 'timestamp'>): void {
    this.logFromEntry('INFO', entry);
  }

  public warn(entry: Omit<LogEntry, 'severity' | 'timestamp'>): void {
    this.logFromEntry('WARN', entry);
  }

  public error(entry: Omit<LogEntry, 'severity' | 'timestamp'>): void {
    this.logFromEntry('ERROR', entry);
  }

  public fatal(entry: Omit<LogEntry, 'severity' | 'timestamp'>): void {
    this.logFromEntry('FATAL', entry);
  }

  // --- Direct canonical structured logging ---

  public logEvent(event: Omit<LogEvent, 'eventId' | 'timestamp'>): void {
    if (ObservabilityLogger.SEVERITY_LEVELS[event.level] < ObservabilityLogger.SEVERITY_LEVELS[this.minLevel]) {
      return;
    }

    const ambient = CorrelationContext.current();
    const sanitizedMetadata = event.metadata
      ? (this.sanitizer.sanitize(event.metadata) as Record<string, unknown>)
      : undefined;

    const fullEvent: LogEvent = {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      level: event.level,
      eventName: event.eventName,
      service: event.service || this.serviceName,
      instanceId: event.instanceId ?? ambient?.instanceId ?? this.instanceId,
      role: event.role ?? ambient?.role ?? this.role,
      environment: event.environment ?? this.environment,
      component: event.component || this.defaultComponent,
      operation: event.operation,
      message: this.sanitizer.sanitizeLogMessage(event.message),
      requestId: event.requestId ?? ambient?.requestId,
      correlationId: event.correlationId ?? ambient?.correlationId,
      causationId: event.causationId ?? ambient?.causationId,
      traceId: event.traceId ?? ambient?.traceId,
      spanId: event.spanId ?? ambient?.spanId,
      jobId: event.jobId ?? ambient?.jobId,
      attemptNumber: event.attemptNumber ?? ambient?.attemptNumber,
      aggregateId: event.aggregateId ?? ambient?.aggregateId,
      principalReference: event.principalReference ?? ambient?.principalId,
      workspaceId: event.workspaceId ?? ambient?.workspaceId,
      organizationId: event.organizationId ?? ambient?.organizationId,
      repositoryId: event.repositoryId ?? ambient?.repositoryId,
      sessionId: event.sessionId ?? ambient?.sessionId,
      taskId: event.taskId ?? ambient?.taskId,
      durationMs: event.durationMs,
      outcome: event.outcome,
      errorCode: event.errorCode,
      errorClassification: event.errorClassification,
      errorStack: event.errorStack ? this.sanitizer.sanitizeString(event.errorStack) : undefined,
      metadata: sanitizedMetadata,
    };

    this.emitEvent(fullEvent);
  }

  public getBufferedEvents(): readonly LogEvent[] {
    return [...this.inMemoryBuffer];
  }

  public clearBuffer(): void {
    this.inMemoryBuffer.length = 0;
  }

  private logFromEntry(severity: LogSeverity, entryData: Omit<LogEntry, 'severity' | 'timestamp'>): void {
    if (ObservabilityLogger.SEVERITY_LEVELS[severity] < ObservabilityLogger.SEVERITY_LEVELS[this.minLevel]) {
      return;
    }

    const ambient = CorrelationContext.current();
    const details = entryData.details ? (this.sanitizer.sanitize(entryData.details) as Record<string, unknown>) : undefined;

    const fullEvent: LogEvent = {
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      level: severity,
      service: this.serviceName,
      instanceId: ambient?.instanceId ?? this.instanceId,
      role: ambient?.role ?? this.role,
      environment: this.environment,
      component: entryData.component || this.defaultComponent,
      operation: entryData.operation || 'unknown',
      message: this.sanitizer.sanitizeLogMessage(entryData.message),
      correlationId: entryData.correlationId ?? ambient?.correlationId,
      causationId: ambient?.causationId,
      requestId: ambient?.requestId,
      traceId: ambient?.traceId,
      spanId: ambient?.spanId,
      jobId: ambient?.jobId,
      attemptNumber: ambient?.attemptNumber,
      aggregateId: ambient?.aggregateId,
      organizationId: ambient?.organizationId,
      workspaceId: entryData.workspaceId ?? ambient?.workspaceId,
      repositoryId: entryData.repositoryId ?? ambient?.repositoryId,
      durationMs: entryData.durationMs,
      metadata: details,
    };

    this.emitEvent(fullEvent);
  }

  private emitEvent(event: LogEvent): void {
    // Retain bounded buffer in-memory
    this.inMemoryBuffer.push(event);
    if (this.inMemoryBuffer.length > this.maxBufferSize) {
      this.inMemoryBuffer.shift();
    }

    try {
      const line = this.formatLine(event);

      if (this.sink) {
        this.sink(line, event);
        return;
      }

      if (event.level === 'ERROR' || event.level === 'FATAL') {
        console.error(line);
      } else if (event.level === 'WARN') {
        console.warn(line);
      } else {
        console.log(line);
      }
    } catch {
      // Telemetry failure isolation: logging failures must NEVER crash domain execution
    }
  }

  private formatLine(event: LogEvent): string {
    if (this.format === 'json') {
      return JSON.stringify(event);
    }

    const durationStr = event.durationMs !== undefined ? ` [${event.durationMs}ms]` : '';
    const corrStr = event.correlationId ? ` (corr=${event.correlationId})` : '';
    const metaStr = event.metadata ? ` ${JSON.stringify(event.metadata)}` : '';
    return `[${event.timestamp}] [${event.level}] [${event.component}:${event.operation}] ${event.message}${durationStr}${corrStr}${metaStr}`;
  }
}

