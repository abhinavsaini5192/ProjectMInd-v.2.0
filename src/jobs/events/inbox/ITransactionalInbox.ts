import type { InboxRecord, InboxProcessingStatus } from '../models/DurableEvent.js';

export interface ITransactionalInbox {
  isProcessed(eventId: string, consumerName: string): Promise<boolean>;
  recordProcessed(entry: {
    eventId: string;
    consumerName: string;
    aggregateType: string;
    aggregateId: string;
    aggregateSeq: number;
    status: InboxProcessingStatus;
    result?: Record<string, unknown>;
  }): Promise<InboxRecord>;
  getLastProcessedSeq(consumerName: string, aggregateType: string, aggregateId: string): Promise<number>;
  getProcessedCount(consumerName?: string): Promise<number>;
  clear(): Promise<void>;
}

export const ITransactionalInboxToken = Symbol.for('ITransactionalInbox');
