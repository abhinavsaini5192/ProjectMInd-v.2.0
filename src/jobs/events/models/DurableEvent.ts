export type EventDeliveryStatus = 'PENDING' | 'DISPATCHED' | 'FAILED' | 'DEAD_LETTER';
export type InboxProcessingStatus = 'PROCESSED' | 'FAILED' | 'SKIPPED';

export interface DurableEvent<T = Record<string, unknown>> {
  readonly eventId: string;
  readonly eventType: string;
  readonly schemaVersion: number;
  readonly workspaceId: string;
  readonly organizationId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateSeq: number;
  readonly correlationId: string;
  readonly causationId?: string | undefined;
  readonly createdAt: string;
  readonly payload: Readonly<T>;
  readonly status: EventDeliveryStatus;
  readonly attemptCount: number;
  readonly nextAttemptAt?: string | undefined;
  readonly dispatchedAt?: string | undefined;
}

export interface CreateDurableEventParams<T = Record<string, unknown>> {
  readonly eventType: string;
  readonly schemaVersion?: number | undefined;
  readonly workspaceId: string;
  readonly organizationId?: string | undefined;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateSeq?: number | undefined;
  readonly correlationId?: string | undefined;
  readonly causationId?: string | undefined;
  readonly payload: T;
}

export interface InboxRecord {
  readonly inboxId: string;
  readonly eventId: string;
  readonly consumerName: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly aggregateSeq: number;
  readonly processedAt: string;
  readonly status: InboxProcessingStatus;
  readonly result?: Record<string, unknown> | undefined;
}

export interface ReplayAuditRecord {
  readonly replayId: string;
  readonly initiatedBy: string;
  readonly reason: string;
  readonly filterCriteria: Record<string, unknown>;
  readonly eventsMatched: number;
  readonly eventsReplayed: number;
  readonly initiatedAt: string;
  readonly completedAt: string;
}
