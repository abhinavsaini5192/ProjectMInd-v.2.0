import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { ITransactionalOutbox } from './ITransactionalOutbox.js';
import type { DurableEvent, CreateDurableEventParams } from '../models/DurableEvent.js';
import { initializeJobDatabaseSchema } from '../../persistence/JobDatabaseSchema.js';
import { CorrelationContext } from '../../../observability/correlation/CorrelationContext.js';

export class SqliteTransactionalOutbox implements ITransactionalOutbox {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    initializeJobDatabaseSchema(this.db);
  }

  private rowToEvent<T = Record<string, unknown>>(row: any): DurableEvent<T> {
    return {
      eventId: row.event_id,
      eventType: row.event_type,
      schemaVersion: row.schema_version,
      workspaceId: row.workspace_id,
      organizationId: row.organization_id,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      aggregateSeq: row.aggregate_seq,
      correlationId: row.correlation_id,
      causationId: row.causation_id ?? undefined,
      createdAt: row.created_at,
      payload: JSON.parse(row.payload_json),
      status: row.status,
      attemptCount: row.attempt_count,
      nextAttemptAt: row.next_attempt_at ?? undefined,
      dispatchedAt: row.dispatched_at ?? undefined,
    };
  }

  public async insertEvent<T = Record<string, unknown>>(
    params: CreateDurableEventParams<T>
  ): Promise<DurableEvent<T>> {
    const ambient = CorrelationContext.current();
    const eventId = `evt-${randomUUID()}`;
    const now = new Date().toISOString();
    const correlationId = params.correlationId ?? ambient?.correlationId ?? `corr-${randomUUID().slice(0, 8)}`;
    const causationId = params.causationId ?? ambient?.causationId ?? ambient?.requestId ?? null;
    const organizationId = params.organizationId ?? ambient?.organizationId ?? 'default-org';
    const schemaVersion = params.schemaVersion ?? 1;


    // Next sequence for aggregate if not provided
    let aggregateSeq = params.aggregateSeq;
    if (aggregateSeq === undefined) {
      const seqStmt = this.db.prepare(
        'SELECT COALESCE(MAX(aggregate_seq), 0) + 1 as next_seq FROM pm_event_outbox WHERE aggregate_type = ? AND aggregate_id = ?'
      );
      const row: any = seqStmt.get(params.aggregateType, params.aggregateId);
      aggregateSeq = row?.next_seq ?? 1;
    }

    const stmt = this.db.prepare(`
      INSERT INTO pm_event_outbox (
        event_id, event_type, schema_version, workspace_id, organization_id,
        aggregate_type, aggregate_id, aggregate_seq, correlation_id,
        causation_id, created_at, payload_json, status, attempt_count,
        next_attempt_at, dispatched_at
      ) VALUES (
        @event_id, @event_type, @schema_version, @workspace_id, @organization_id,
        @aggregate_type, @aggregate_id, @aggregate_seq, @correlation_id,
        @causation_id, @created_at, @payload_json, 'PENDING', 0,
        @next_attempt_at, NULL
      )
    `);

    stmt.run({
      event_id: eventId,
      event_type: params.eventType,
      schema_version: schemaVersion,
      workspace_id: params.workspaceId,
      organization_id: organizationId,
      aggregate_type: params.aggregateType,
      aggregate_id: params.aggregateId,
      aggregate_seq: aggregateSeq,
      correlation_id: correlationId,
      causation_id: params.causationId ?? null,
      created_at: now,
      payload_json: JSON.stringify(params.payload ?? {}),
      next_attempt_at: now,
    });

    return {
      eventId,
      eventType: params.eventType,
      schemaVersion,
      workspaceId: params.workspaceId,
      organizationId,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      aggregateSeq: aggregateSeq ?? 1,
      correlationId,
      causationId: params.causationId,
      createdAt: now,
      payload: params.payload,
      status: 'PENDING',
      attemptCount: 0,
      nextAttemptAt: now,
    };
  }

  public async insertEvents<T = Record<string, unknown>>(
    paramsList: readonly CreateDurableEventParams<T>[]
  ): Promise<readonly DurableEvent<T>[]> {
    const tx = this.db.transaction(() => {
      const results: DurableEvent<T>[] = [];
      for (const params of paramsList) {
        const res = this.insertEventSync(params);
        results.push(res);
      }
      return results;
    });

    return tx();
  }

  private insertEventSync<T = Record<string, unknown>>(
    params: CreateDurableEventParams<T>
  ): DurableEvent<T> {
    const eventId = `evt-${randomUUID()}`;
    const now = new Date().toISOString();
    const correlationId = params.correlationId ?? `corr-${randomUUID().slice(0, 8)}`;
    const organizationId = params.organizationId ?? 'default-org';
    const schemaVersion = params.schemaVersion ?? 1;

    let aggregateSeq = params.aggregateSeq;
    if (aggregateSeq === undefined) {
      const seqStmt = this.db.prepare(
        'SELECT COALESCE(MAX(aggregate_seq), 0) + 1 as next_seq FROM pm_event_outbox WHERE aggregate_type = ? AND aggregate_id = ?'
      );
      const row: any = seqStmt.get(params.aggregateType, params.aggregateId);
      aggregateSeq = row?.next_seq ?? 1;
    }

    const stmt = this.db.prepare(`
      INSERT INTO pm_event_outbox (
        event_id, event_type, schema_version, workspace_id, organization_id,
        aggregate_type, aggregate_id, aggregate_seq, correlation_id,
        causation_id, created_at, payload_json, status, attempt_count,
        next_attempt_at, dispatched_at
      ) VALUES (
        @event_id, @event_type, @schema_version, @workspace_id, @organization_id,
        @aggregate_type, @aggregate_id, @aggregate_seq, @correlation_id,
        @causation_id, @created_at, @payload_json, 'PENDING', 0,
        @next_attempt_at, NULL
      )
    `);

    stmt.run({
      event_id: eventId,
      event_type: params.eventType,
      schema_version: schemaVersion,
      workspace_id: params.workspaceId,
      organization_id: organizationId,
      aggregate_type: params.aggregateType,
      aggregate_id: params.aggregateId,
      aggregate_seq: aggregateSeq,
      correlation_id: correlationId,
      causationId: params.causationId ?? null,
      created_at: now,
      payload_json: JSON.stringify(params.payload ?? {}),
      next_attempt_at: now,
    });

    return {
      eventId,
      eventType: params.eventType,
      schemaVersion,
      workspaceId: params.workspaceId,
      organizationId,
      aggregateType: params.aggregateType,
      aggregateId: params.aggregateId,
      aggregateSeq: aggregateSeq ?? 1,
      correlationId,
      causationId: params.causationId,
      createdAt: now,
      payload: params.payload,
      status: 'PENDING',
      attemptCount: 0,
      nextAttemptAt: now,
    };
  }

  public async fetchPendingEvents(limit: number = 50): Promise<readonly DurableEvent[]> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM pm_event_outbox
      WHERE status = 'PENDING' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY aggregate_type ASC, aggregate_id ASC, aggregate_seq ASC, created_at ASC
      LIMIT ?
    `);

    const rows = stmt.all(now, limit);
    return rows.map((r) => this.rowToEvent(r));
  }

  public async markDispatched(eventId: string): Promise<boolean> {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE pm_event_outbox
      SET status = 'DISPATCHED', dispatched_at = ?
      WHERE event_id = ?
    `);
    const res = stmt.run(now, eventId);
    return res.changes > 0;
  }

  public async recordFailure(eventId: string, error: string, backoffMs: number = 2000): Promise<boolean> {
    const nextAttemptAt = new Date(Date.now() + backoffMs).toISOString();
    const stmt = this.db.prepare(`
      UPDATE pm_event_outbox
      SET attempt_count = attempt_count + 1,
          next_attempt_at = @next_attempt,
          status = CASE WHEN attempt_count + 1 >= 5 THEN 'FAILED' ELSE 'PENDING' END
      WHERE event_id = @event_id
    `);
    const res = stmt.run({
      next_attempt: nextAttemptAt,
      event_id: eventId,
    });
    return res.changes > 0;
  }

  public async getDepth(): Promise<number> {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM pm_event_outbox WHERE status = 'PENDING'");
    const row: any = stmt.get();
    return row?.count ?? 0;
  }

  public async clear(): Promise<void> {
    this.db.exec('DELETE FROM pm_event_outbox');
  }
}
