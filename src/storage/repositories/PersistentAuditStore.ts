import type { AuditEvent } from '../../security/models/AuditEvent.js';
import type { AuditQuery } from '../../security/interfaces/IAuditLogger.js';
import { LogRedactor } from '../../platform/logging/LogRedactor.js';
import { StorageCoreError } from '../types/StorageErrors.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';
import * as crypto from 'crypto';

export interface PersistentAuditRecord {
  readonly recordId: string;
  readonly event: AuditEvent;
  readonly previousChecksum: string;
  readonly checksum: string;
  readonly storedAt: number;
}

export interface IPersistentAuditStore {
  saveEvent(event: AuditEvent): Promise<PersistentAuditRecord>;
  getEvent(eventId: string): Promise<AuditEvent | undefined>;
  queryEvents(query?: AuditQuery): Promise<readonly AuditEvent[]>;
  verifyIntegrity(): Promise<{ isTamperFree: boolean; recordsChecked: number; errors: readonly string[] }>;
}

export class PersistentAuditStore implements IPersistentAuditStore {
  private readonly records = new Map<string, PersistentAuditRecord>();
  private readonly indexByEventId = new Map<string, string>();
  private lastChecksum = '0000000000000000000000000000000000000000000000000000000000000000';

  constructor(private readonly logger?: ILogger | undefined) {}

  public async saveEvent(event: AuditEvent): Promise<PersistentAuditRecord> {
    const recordId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Redact sensitive details
    const sanitizedDetails = event.details
      ? LogRedactor.redactObject(event.details)
      : undefined;

    const sanitizedEvent: AuditEvent = {
      ...event,
      details: sanitizedDetails,
    };

    const previousChecksum = this.lastChecksum;
    const payloadToHash = JSON.stringify({
      event: sanitizedEvent,
      previousChecksum,
    });
    const checksum = crypto.createHash('sha256').update(payloadToHash).digest('hex');
    this.lastChecksum = checksum;

    const record: PersistentAuditRecord = {
      recordId,
      event: sanitizedEvent,
      previousChecksum,
      checksum,
      storedAt: Date.now(),
    };

    this.records.set(recordId, record);
    this.indexByEventId.set(event.eventId, recordId);

    this.logger?.debug?.({
      component: 'PersistentAuditStore',
      operation: 'saveEvent',
      message: `Persisted audit event '${event.eventId}' (type: ${event.eventType})`,
    });

    return record;
  }

  public async getEvent(eventId: string): Promise<AuditEvent | undefined> {
    const recordId = this.indexByEventId.get(eventId);
    if (!recordId) return undefined;
    return this.records.get(recordId)?.event;
  }

  public async queryEvents(query?: AuditQuery): Promise<readonly AuditEvent[]> {
    let result = Array.from(this.records.values()).map((r) => r.event);

    if (!query) return result;

    if (query.principalId) {
      result = result.filter((e) => e.principalId === query.principalId);
    }
    if (query.workspaceId) {
      result = result.filter((e) => e.workspaceId === query.workspaceId);
    }
    if (query.repositoryId) {
      result = result.filter((e) => e.repositoryId === query.repositoryId);
    }
    if (query.eventType) {
      result = result.filter((e) => e.eventType === query.eventType);
    }
    if (query.fromTimestamp) {
      const from = new Date(query.fromTimestamp).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() >= from);
    }
    if (query.toTimestamp) {
      const to = new Date(query.toTimestamp).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() <= to);
    }
    if (query.limit && query.limit > 0) {
      result = result.slice(-query.limit);
    }

    return result;
  }

  public async verifyIntegrity(): Promise<{
    isTamperFree: boolean;
    recordsChecked: number;
    errors: readonly string[];
  }> {
    const errors: string[] = [];
    const recordList = Array.from(this.records.values()).sort((a, b) => a.storedAt - b.storedAt);
    let expectedPrevious = '0000000000000000000000000000000000000000000000000000000000000000';

    for (const record of recordList) {
      if (record.previousChecksum !== expectedPrevious) {
        errors.push(
          `Checksum chain broken on audit record '${record.recordId}': expected prev '${expectedPrevious}', actual '${record.previousChecksum}'`
        );
      }

      const payload = JSON.stringify({
        event: record.event,
        previousChecksum: record.previousChecksum,
      });
      const recomputed = crypto.createHash('sha256').update(payload).digest('hex');

      if (recomputed !== record.checksum) {
        errors.push(
          `Payload tamper detected on audit record '${record.recordId}': stored '${record.checksum}', recomputed '${recomputed}'`
        );
      }

      expectedPrevious = record.checksum;
    }

    return {
      isTamperFree: errors.length === 0,
      recordsChecked: recordList.length,
      errors,
    };
  }

  public deleteEvent(): never {
    throw new StorageCoreError(
      'Audit records are immutable and cannot be deleted by storage policy.'
    );
  }
}
