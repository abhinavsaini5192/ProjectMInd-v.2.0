import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { IJobQueue } from './IJobQueue.js';
import type { QueueMessage } from './QueueMessage.js';
import type { JobPriority } from '../models/JobPriority.js';
import { initializeJobDatabaseSchema } from '../persistence/JobDatabaseSchema.js';

const PRIORITY_WEIGHTS: Record<JobPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

export class DurableJobQueue implements IJobQueue {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    initializeJobDatabaseSchema(this.db);
  }

  public async enqueue(jobId: string, priority: JobPriority = 'NORMAL', delayMs: number = 0): Promise<string> {
    const messageId = `msg-${randomUUID()}`;
    const now = Date.now();
    const availableAt = now + Math.max(0, delayMs);
    const weight = PRIORITY_WEIGHTS[priority] ?? 2;

    const stmt = this.db.prepare(`
      INSERT INTO pm_queue_messages (
        message_id, job_id, priority, priority_weight,
        receipt_handle, delivery_count, enqueued_at,
        available_at_ms, visible_after_ms, status
      ) VALUES (
        @message_id, @job_id, @priority, @priority_weight,
        NULL, 0, @enqueued_at,
        @available_at_ms, @visible_after_ms, 'READY'
      )
    `);

    stmt.run({
      message_id: messageId,
      job_id: jobId,
      priority,
      priority_weight: weight,
      enqueued_at: new Date(now).toISOString(),
      available_at_ms: availableAt,
      visible_after_ms: availableAt,
    });

    return messageId;
  }

  public async dequeue(visibilityTimeoutMs: number = 30000): Promise<QueueMessage | null> {
    const tx = this.db.transaction(() => {
      const now = Date.now();

      // 1. Reclaim expired in-flight messages back to READY
      this.db.prepare(`
        UPDATE pm_queue_messages
        SET status = 'READY', receipt_handle = NULL
        WHERE status = 'IN_FLIGHT' AND visible_after_ms <= ?
      `).run(now);

      // 2. Claim next available message
      const selectStmt = this.db.prepare(`
        SELECT * FROM pm_queue_messages
        WHERE status = 'READY' AND available_at_ms <= ?
        ORDER BY priority_weight DESC, available_at_ms ASC, enqueued_at ASC
        LIMIT 1
      `);

      const candidate: any = selectStmt.get(now);
      if (!candidate) return null;

      const receiptHandle = `rcpt-${randomUUID()}`;
      const visibleAfterMs = now + visibilityTimeoutMs;
      const nextDeliveryCount = candidate.delivery_count + 1;

      this.db.prepare(`
        UPDATE pm_queue_messages
        SET status = 'IN_FLIGHT',
            receipt_handle = @receipt_handle,
            delivery_count = @delivery_count,
            visible_after_ms = @visible_after_ms
        WHERE message_id = @message_id
      `).run({
        message_id: candidate.message_id,
        receipt_handle: receiptHandle,
        delivery_count: nextDeliveryCount,
        visible_after_ms: visibleAfterMs,
      });

      const message: QueueMessage = {
        messageId: candidate.message_id,
        jobId: candidate.job_id,
        priority: candidate.priority,
        receiptHandle,
        deliveryCount: nextDeliveryCount,
        enqueuedAt: candidate.enqueued_at,
        visibleAfterMs,
      };

      return message;
    });

    return tx();
  }

  public async acknowledge(receiptHandle: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM pm_queue_messages WHERE receipt_handle = ?');
    const res = stmt.run(receiptHandle);
    return res.changes > 0;
  }

  public async reject(receiptHandle: string, requeue: boolean = true): Promise<boolean> {
    if (requeue) {
      const stmt = this.db.prepare(`
        UPDATE pm_queue_messages
        SET status = 'READY', receipt_handle = NULL
        WHERE receipt_handle = ?
      `);
      const res = stmt.run(receiptHandle);
      return res.changes > 0;
    }

    return this.acknowledge(receiptHandle);
  }

  public async requeue(receiptHandle: string, delayMs: number = 0): Promise<boolean> {
    const now = Date.now();
    const availableAt = now + Math.max(0, delayMs);

    const stmt = this.db.prepare(`
      UPDATE pm_queue_messages
      SET status = 'READY',
          receipt_handle = NULL,
          available_at_ms = @available_at,
          visible_after_ms = @available_at
      WHERE receipt_handle = @receipt_handle
    `);

    const res = stmt.run({
      available_at: availableAt,
      receipt_handle: receiptHandle,
    });

    return res.changes > 0;
  }

  public async inspect(limit: number = 50): Promise<readonly QueueMessage[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM pm_queue_messages
      WHERE status = 'READY'
      ORDER BY priority_weight DESC, available_at_ms ASC, enqueued_at ASC
      LIMIT ?
    `);

    const rows = stmt.all(limit);
    return rows.map((r: any) => ({
      messageId: r.message_id,
      jobId: r.job_id,
      priority: r.priority,
      receiptHandle: r.receipt_handle ?? '',
      deliveryCount: r.delivery_count,
      enqueuedAt: r.enqueued_at,
      visibleAfterMs: r.visible_after_ms,
    }));
  }

  public async getDepth(): Promise<number> {
    const stmt = this.db.prepare("SELECT COUNT(*) as count FROM pm_queue_messages WHERE status = 'READY'");
    const row: any = stmt.get();
    return row?.count ?? 0;
  }

  public async clear(): Promise<void> {
    this.db.exec('DELETE FROM pm_queue_messages');
  }
}
