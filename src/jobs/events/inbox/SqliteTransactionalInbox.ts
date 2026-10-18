import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { ITransactionalInbox } from './ITransactionalInbox.js';
import type { InboxRecord, InboxProcessingStatus } from '../models/DurableEvent.js';
import { initializeJobDatabaseSchema } from '../../persistence/JobDatabaseSchema.js';

export class SqliteTransactionalInbox implements ITransactionalInbox {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    initializeJobDatabaseSchema(this.db);
  }

  public async isProcessed(eventId: string, consumerName: string): Promise<boolean> {
    const stmt = this.db.prepare(
      'SELECT 1 FROM pm_event_inbox WHERE event_id = ? AND consumer_name = ?'
    );
    const row = stmt.get(eventId, consumerName);
    return !!row;
  }

  public async recordProcessed(entry: {
    eventId: string;
    consumerName: string;
    aggregateType: string;
    aggregateId: string;
    aggregateSeq: number;
    status: InboxProcessingStatus;
    result?: Record<string, unknown>;
  }): Promise<InboxRecord> {
    const inboxId = `inbox-${randomUUID()}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO pm_event_inbox (
        inbox_id, event_id, consumer_name, aggregate_type,
        aggregate_id, aggregate_seq, processed_at, status, result_json
      ) VALUES (
        @inbox_id, @event_id, @consumer_name, @aggregate_type,
        @aggregate_id, @aggregate_seq, @processed_at, @status, @result_json
      )
      ON CONFLICT(event_id, consumer_name) DO UPDATE SET
        status = excluded.status,
        processed_at = excluded.processed_at,
        result_json = excluded.result_json
    `);

    stmt.run({
      inbox_id: inboxId,
      event_id: entry.eventId,
      consumer_name: entry.consumerName,
      aggregate_type: entry.aggregateType,
      aggregate_id: entry.aggregateId,
      aggregate_seq: entry.aggregateSeq,
      processed_at: now,
      status: entry.status,
      result_json: entry.result ? JSON.stringify(entry.result) : null,
    });

    return {
      inboxId,
      eventId: entry.eventId,
      consumerName: entry.consumerName,
      aggregateType: entry.aggregateType,
      aggregateId: entry.aggregateId,
      aggregateSeq: entry.aggregateSeq,
      processedAt: now,
      status: entry.status,
      result: entry.result,
    };
  }

  public async getLastProcessedSeq(
    consumerName: string,
    aggregateType: string,
    aggregateId: string
  ): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT COALESCE(MAX(aggregate_seq), 0) as last_seq
      FROM pm_event_inbox
      WHERE consumer_name = ? AND aggregate_type = ? AND aggregate_id = ? AND status = 'PROCESSED'
    `);
    const row: any = stmt.get(consumerName, aggregateType, aggregateId);
    return row?.last_seq ?? 0;
  }

  public async getProcessedCount(consumerName?: string): Promise<number> {
    if (consumerName) {
      const stmt = this.db.prepare("SELECT COUNT(*) as count FROM pm_event_inbox WHERE consumer_name = ? AND status = 'PROCESSED'");
      const row: any = stmt.get(consumerName);
      return row?.count ?? 0;
    }
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM pm_event_inbox WHERE status = 'PROCESSED'");
    const row: any = stmt.get();
    return row?.count ?? 0;
  }

  public async clear(): Promise<void> {
    this.db.exec('DELETE FROM pm_event_inbox');
  }
}
