import type { LogSeverity } from '../../workspace/interfaces/ILogger.js';

export type LogLevel = LogSeverity;

export interface LogEvent {
  readonly eventId: string;
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly eventName?: string | undefined;
  readonly service: string;
  readonly instanceId?: string | undefined;
  readonly role?: string | undefined;
  readonly environment?: string | undefined;
  readonly component: string;
  readonly operation: string;
  readonly message: string;
  readonly requestId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly causationId?: string | undefined;
  readonly traceId?: string | undefined;
  readonly spanId?: string | undefined;
  readonly jobId?: string | undefined;
  readonly attemptNumber?: number | undefined;
  readonly aggregateId?: string | undefined;
  readonly principalReference?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly organizationId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly durationMs?: number | undefined;
  readonly outcome?: 'SUCCESS' | 'FAILURE' | 'CANCELLED' | 'UNKNOWN' | undefined;
  readonly errorCode?: string | undefined;
  readonly errorClassification?: string | undefined;
  readonly errorStack?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
