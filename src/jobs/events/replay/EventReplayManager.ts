import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { ReplayAuditRecord } from '../models/DurableEvent.js';
import { initializeJobDatabaseSchema } from '../../persistence/JobDatabaseSchema.js';

export interface EventReplayCriteria {
  readonly workspaceId?: string | undefined;
  readonly aggregateType?: string | undefined;
  readonly aggregateId?: string | undefined;
  readonly eventType?: string | undefined;
  readonly maxBatchSize?: number | undefined;
  readonly [key: string]: unknown;
}

export class EventReplayManager {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    initializeJobDatabaseSchema(this.db);
  }

  public async replayEvents(
    criteria: EventReplayCriteria,
    initiatedBy: string,
    reason: string
  ): Promise<ReplayAuditRecord> {
    if (!initiatedBy || initiatedBy.trim() === '') {
      throw new Error('Authorized operator identity is required for event replay');
    }
    if (!reason || reason.trim() === '') {
      throw new Error('Operational reason is required for event replay audit log');
    }

    const replayId = `rpl-${randomUUID()}`;
    const initiatedAt = new Date().toISOString();
    const batchLimit = Math.min(criteria.maxBatchSize ?? 100, 500); // enforce bounded batch cap

    let query = 'SELECT * FROM pm_event_outbox WHERE status = ?';
    const params: any[] = ['DISPATCHED'];

    if (criteria.workspaceId) {
      query += ' AND workspace_id = ?';
      params.push(criteria.workspaceId);
    }
    if (criteria.aggregateType) {
      query += ' AND aggregate_type = ?';
      params.push(criteria.aggregateType);
    }
    if (criteria.aggregateId) {
      query += ' AND aggregate_id = ?';
      params.push(criteria.aggregateId);
    }
    if (criteria.eventType) {
      query += ' AND event_type = ?';
      params.push(criteria.eventType);
    }

    query += ' ORDER BY created_at ASC LIMIT ?';
    params.push(batchLimit);

    const selectStmt = this.db.prepare(query);
    const candidateEvents = selectStmt.all(...params);

    const updateStmt = this.db.prepare(`
      UPDATE pm_event_outbox
      SET status = 'PENDING',
          next_attempt_at = @now,
          attempt_count = 0
      WHERE event_id = @event_id
    `);

    let replayedCount = 0;
    const nowIso = new Date().toISOString();

    const tx = this.db.transaction(() => {
      for (const ev of candidateEvents) {
        updateStmt.run({
          now: nowIso,
          event_id: (ev as any).event_id,
        });
        replayedCount++;
      }

      const completedAt = new Date().toISOString();
      const auditStmt = this.db.prepare(`
        INSERT INTO pm_event_replay_audit (
          replay_id, initiated_by, reason, filter_criteria_json,
          events_matched, events_replayed, initiated_at, completed_at
        ) VALUES (
          @replay_id, @initiated_by, @reason, @filter_criteria_json,
          @events_matched, @events_replayed, @initiated_at, @completed_at
        )
      `);

      auditStmt.run({
        replay_id: replayId,
        initiated_by: initiatedBy,
        reason,
        filter_criteria_json: JSON.stringify(criteria),
        events_matched: candidateEvents.length,
        events_replayed: replayedCount,
        initiated_at: initiatedAt,
        completed_at: completedAt,
      });

      return {
        replayId,
        initiatedBy,
        reason,
        filterCriteria: criteria,
        eventsMatched: candidateEvents.length,
        eventsReplayed: replayedCount,
        initiatedAt,
        completedAt,
      };
    });

    return tx();
  }

  public async getAuditHistory(limit: number = 50): Promise<readonly ReplayAuditRecord[]> {
    const stmt = this.db.prepare(
      'SELECT * FROM pm_event_replay_audit ORDER BY initiated_at DESC LIMIT ?'
    );
    const rows = stmt.all(limit);

    return rows.map((r: any) => ({
      replayId: r.replay_id,
      initiatedBy: r.initiated_by,
      reason: r.reason,
      filterCriteria: JSON.parse(r.filter_criteria_json),
      eventsMatched: r.events_matched,
      eventsReplayed: r.events_replayed,
      initiatedAt: r.initiated_at,
      completedAt: r.completed_at,
    }));
  }
}
