export type LogSeverity = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogEntry {
  timestamp: string;
  component: string;
  operation: string;
  correlationId?: string;
  repositoryId?: string;
  workspaceId?: string;
  durationMs?: number;
  severity: LogSeverity;
  message: string;
  details?: Record<string, any>;
}

export type LogPayload = Omit<LogEntry, 'severity' | 'timestamp'> & { severity?: LogSeverity | undefined };

export interface ILogger {
  debug(entry: LogPayload): void;
  info(entry: LogPayload): void;
  warn(entry: LogPayload): void;
  error(entry: LogPayload): void;
  fatal(entry: LogPayload): void;
}

export const ILoggerToken = Symbol('ILogger');
