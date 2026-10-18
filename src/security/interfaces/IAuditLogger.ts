import type { AuditEvent, AuditEventType } from '../models/AuditEvent.js';

export interface AuditQuery {
  readonly principalId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly eventType?: AuditEventType | undefined;
  readonly fromTimestamp?: string | undefined;
  readonly toTimestamp?: string | undefined;
  readonly limit?: number | undefined;
}

export interface AuditIntegrityResult {
  readonly isTamperFree: boolean;
  readonly totalEvents: number;
  readonly brokenAtEventId?: string | undefined;
  readonly brokenSequenceNumber?: number | undefined;
  readonly reason?: string | undefined;
}

export interface IAuditLogger {
  logEvent(event: Omit<AuditEvent, 'eventId' | 'timestamp'>): Promise<AuditEvent>;
  queryEvents(query?: AuditQuery): Promise<readonly AuditEvent[]>;
  verifyIntegrity?(): Promise<AuditIntegrityResult>;
}
