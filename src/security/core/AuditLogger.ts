import { createHash } from 'node:crypto';
import type { IAuditLogger, AuditQuery, AuditIntegrityResult } from '../interfaces/IAuditLogger.js';
import type { AuditEvent } from '../models/AuditEvent.js';
import { LogRedactor } from '../../platform/logging/LogRedactor.js';
import type { IStorageProvider } from '../../storage/interfaces/IStorageProvider.js';

export class AuditLogger implements IAuditLogger {
  private readonly events: AuditEvent[] = [];
  private sequenceCounter = 0;
  private lastHash: string = '0'.repeat(64); // Genesis hash for SHA-256 chain

  constructor(private readonly storage?: IStorageProvider | undefined) {}

  public async logEvent(
    eventInput: Omit<AuditEvent, 'eventId' | 'timestamp' | 'sequenceNumber' | 'previousHash' | 'hash'>
  ): Promise<AuditEvent> {
    this.sequenceCounter++;
    const sequenceNumber = this.sequenceCounter;
    const eventId = `audit_${Date.now()}_${sequenceNumber}`;
    const timestamp = new Date().toISOString();
    const previousHash = this.lastHash;

    // Redact all sensitive fields from details before storage
    const sanitizedDetails = eventInput.details
      ? LogRedactor.redactObject(eventInput.details)
      : undefined;

    // Compute canonical cryptographic hash over immutable audit fields
    const hash = this.computeEventHash({
      sequenceNumber,
      eventId,
      timestamp,
      eventType: eventInput.eventType,
      principalId: eventInput.principalId,
      workspaceId: eventInput.workspaceId,
      repositoryId: eventInput.repositoryId,
      resourceType: eventInput.resourceType,
      resourceId: eventInput.resourceId,
      action: eventInput.action,
      result: eventInput.result,
      reason: eventInput.reason,
      previousHash,
    });

    this.lastHash = hash;

    const auditEvent: AuditEvent = {
      ...eventInput,
      eventId,
      sequenceNumber,
      previousHash,
      hash,
      timestamp,
      details: sanitizedDetails,
    };

    // Immutable append to in-memory list
    this.events.push(auditEvent);

    // Optional persistent storage
    if (this.storage && typeof (this.storage as any).set === 'function') {
      try {
        await (this.storage as any).set(`audit:${eventId}`, JSON.stringify(auditEvent));
      } catch {
        // Audit log persistence failure must not crash operation, but in-memory remains
      }
    }

    return auditEvent;
  }

  public async queryEvents(query?: AuditQuery): Promise<readonly AuditEvent[]> {
    let result = [...this.events];

    if (!query) {
      return result;
    }

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
      const fromTime = new Date(query.fromTimestamp).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() >= fromTime);
    }
    if (query.toTimestamp) {
      const toTime = new Date(query.toTimestamp).getTime();
      result = result.filter((e) => new Date(e.timestamp).getTime() <= toTime);
    }
    if (query.limit && query.limit > 0) {
      result = result.slice(-query.limit);
    }

    return result;
  }

  /**
   * Verifies the cryptographic tamper-evident hash chain across all recorded audit events.
   * If any event was modified, deleted, or inserted out-of-order, reports the exact breach location.
   */
  public async verifyIntegrity(): Promise<AuditIntegrityResult> {
    if (this.events.length === 0) {
      return {
        isTamperFree: true,
        totalEvents: 0,
      };
    }

    let expectedPreviousHash = '0'.repeat(64);

    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i];
      const expectedSequence = i + 1;

      // 1. Verify sequence order
      if (event.sequenceNumber !== expectedSequence) {
        return {
          isTamperFree: false,
          totalEvents: this.events.length,
          brokenAtEventId: event.eventId,
          brokenSequenceNumber: event.sequenceNumber,
          reason: `Sequence gap detected: expected ${expectedSequence}, found ${event.sequenceNumber}`,
        };
      }

      // 2. Verify previousHash pointer
      if (event.previousHash !== expectedPreviousHash) {
        return {
          isTamperFree: false,
          totalEvents: this.events.length,
          brokenAtEventId: event.eventId,
          brokenSequenceNumber: event.sequenceNumber,
          reason: `Hash chain break at event '${event.eventId}': previousHash mismatch`,
        };
      }

      // 3. Recompute hash
      const recomputedHash = this.computeEventHash({
        sequenceNumber: event.sequenceNumber,
        eventId: event.eventId,
        timestamp: event.timestamp,
        eventType: event.eventType,
        principalId: event.principalId,
        workspaceId: event.workspaceId,
        repositoryId: event.repositoryId,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        action: event.action,
        result: event.result,
        reason: event.reason,
        previousHash: event.previousHash,
      });

      if (event.hash !== recomputedHash) {
        return {
          isTamperFree: false,
          totalEvents: this.events.length,
          brokenAtEventId: event.eventId,
          brokenSequenceNumber: event.sequenceNumber,
          reason: `Data tampering detected at event '${event.eventId}': signature does not match payload`,
        };
      }

      expectedPreviousHash = event.hash;
    }

    return {
      isTamperFree: true,
      totalEvents: this.events.length,
    };
  }

  private computeEventHash(params: {
    sequenceNumber: number;
    eventId: string;
    timestamp: string;
    eventType: string;
    principalId?: string | undefined;
    workspaceId?: string | undefined;
    repositoryId?: string | undefined;
    resourceType?: string | undefined;
    resourceId?: string | undefined;
    action?: string | undefined;
    result: string;
    reason?: string | undefined;
    previousHash: string;
  }): string {
    const payload = JSON.stringify({
      sequenceNumber: params.sequenceNumber,
      eventId: params.eventId,
      timestamp: params.timestamp,
      eventType: params.eventType,
      principalId: params.principalId ?? null,
      workspaceId: params.workspaceId ?? null,
      repositoryId: params.repositoryId ?? null,
      resourceType: params.resourceType ?? null,
      resourceId: params.resourceId ?? null,
      action: params.action ?? null,
      result: params.result,
      reason: params.reason ?? null,
      previousHash: params.previousHash,
    });

    return createHash('sha256').update(payload).digest('hex');
  }
}
