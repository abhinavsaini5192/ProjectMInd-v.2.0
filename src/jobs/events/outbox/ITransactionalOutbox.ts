import type { DurableEvent, CreateDurableEventParams } from '../models/DurableEvent.js';

export interface ITransactionalOutbox {
  insertEvent<T = Record<string, unknown>>(params: CreateDurableEventParams<T>): Promise<DurableEvent<T>>;
  insertEvents<T = Record<string, unknown>>(paramsList: readonly CreateDurableEventParams<T>[]): Promise<readonly DurableEvent<T>[]>;
  fetchPendingEvents(limit?: number): Promise<readonly DurableEvent[]>;
  markDispatched(eventId: string): Promise<boolean>;
  recordFailure(eventId: string, error: string, backoffMs?: number): Promise<boolean>;
  getDepth(): Promise<number>;
  clear(): Promise<void>;
}

export const ITransactionalOutboxToken = Symbol.for('ITransactionalOutbox');
