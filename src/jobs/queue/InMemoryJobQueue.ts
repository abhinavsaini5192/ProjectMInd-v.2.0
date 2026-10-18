import { randomUUID } from 'node:crypto';
import type { IJobQueue } from './IJobQueue.js';
import type { QueueMessage } from './QueueMessage.js';
import { type JobPriority, compareJobPriorities } from '../models/JobPriority.js';
import { JobError } from '../models/JobError.js';

interface InternalQueueEntry {
  readonly messageId: string;
  readonly jobId: string;
  readonly priority: JobPriority;
  readonly enqueuedAtMs: number;
  visibleAfterMs: number;
  deliveryCount: number;
}

export interface InMemoryJobQueueOptions {
  readonly maxCapacity?: number | undefined;
  readonly defaultVisibilityTimeoutMs?: number | undefined;
}

export class InMemoryJobQueue implements IJobQueue {
  private readonly items: InternalQueueEntry[] = [];
  private readonly inFlight = new Map<string, { entry: InternalQueueEntry; expiresAtMs: number }>();
  private readonly maxCapacity: number;
  private readonly defaultVisibilityTimeoutMs: number;

  constructor(options: InMemoryJobQueueOptions = {}) {
    this.maxCapacity = options.maxCapacity ?? 10000;
    this.defaultVisibilityTimeoutMs = options.defaultVisibilityTimeoutMs ?? 30000;
  }

  public async enqueue(jobId: string, priority: JobPriority = 'NORMAL', delayMs: number = 0): Promise<string> {
    this.reclaimExpiredInFlight();

    if (this.items.length + this.inFlight.size >= this.maxCapacity) {
      throw new JobError(
        'QUEUE_CAPACITY_EXCEEDED',
        `Job queue capacity of ${this.maxCapacity} exceeded. Backpressure triggered.`,
        true
      );
    }

    const messageId = randomUUID();
    const now = Date.now();
    const entry: InternalQueueEntry = {
      messageId,
      jobId,
      priority,
      enqueuedAtMs: now,
      visibleAfterMs: now + Math.max(0, delayMs),
      deliveryCount: 0,
    };

    this.insertEntry(entry);
    return messageId;
  }

  public async dequeue(visibilityTimeoutMs?: number): Promise<QueueMessage | null> {
    this.reclaimExpiredInFlight();

    const now = Date.now();
    const readyIndex = this.items.findIndex((item) => item.visibleAfterMs <= now);
    if (readyIndex === -1) {
      return null;
    }

    const [entry] = this.items.splice(readyIndex, 1);
    if (!entry) return null;

    entry.deliveryCount++;
    const timeout = visibilityTimeoutMs ?? this.defaultVisibilityTimeoutMs;
    const receiptHandle = randomUUID();

    this.inFlight.set(receiptHandle, {
      entry,
      expiresAtMs: now + timeout,
    });

    return {
      messageId: entry.messageId,
      jobId: entry.jobId,
      priority: entry.priority,
      receiptHandle,
      deliveryCount: entry.deliveryCount,
      enqueuedAt: new Date(entry.enqueuedAtMs).toISOString(),
      visibleAfterMs: entry.visibleAfterMs,
    };
  }

  public async acknowledge(receiptHandle: string): Promise<boolean> {
    return this.inFlight.delete(receiptHandle);
  }

  public async reject(receiptHandle: string, requeue: boolean = true): Promise<boolean> {
    const flight = this.inFlight.get(receiptHandle);
    if (!flight) return false;

    this.inFlight.delete(receiptHandle);

    if (requeue) {
      flight.entry.visibleAfterMs = Date.now();
      this.insertEntry(flight.entry);
    }
    return true;
  }

  public async requeue(receiptHandle: string, delayMs: number = 0): Promise<boolean> {
    const flight = this.inFlight.get(receiptHandle);
    if (!flight) return false;

    this.inFlight.delete(receiptHandle);
    flight.entry.visibleAfterMs = Date.now() + Math.max(0, delayMs);
    this.insertEntry(flight.entry);
    return true;
  }

  public async inspect(limit: number = 50): Promise<readonly QueueMessage[]> {
    this.reclaimExpiredInFlight();
    const count = Math.min(limit, this.items.length);
    const result: QueueMessage[] = [];

    for (let i = 0; i < count; i++) {
      const entry = this.items[i]!;
      result.push({
        messageId: entry.messageId,
        jobId: entry.jobId,
        priority: entry.priority,
        receiptHandle: '',
        deliveryCount: entry.deliveryCount,
        enqueuedAt: new Date(entry.enqueuedAtMs).toISOString(),
        visibleAfterMs: entry.visibleAfterMs,
      });
    }
    return result;
  }

  public async getDepth(): Promise<number> {
    this.reclaimExpiredInFlight();
    return this.items.length;
  }

  public async clear(): Promise<void> {
    this.items.length = 0;
    this.inFlight.clear();
  }

  private insertEntry(entry: InternalQueueEntry): void {
    let low = 0;
    let high = this.items.length;

    while (low < high) {
      const mid = (low + high) >>> 1;
      const midEntry = this.items[mid]!;

      // 1. Compare priorities
      const prioDiff = compareJobPriorities(entry.priority, midEntry.priority);
      if (prioDiff < 0) {
        high = mid;
      } else if (prioDiff > 0) {
        low = mid + 1;
      } else {
        // Same priority: compare scheduled visibility time
        if (entry.visibleAfterMs < midEntry.visibleAfterMs) {
          high = mid;
        } else if (entry.visibleAfterMs > midEntry.visibleAfterMs) {
          low = mid + 1;
        } else {
          // Same visibility: compare enqueued timestamp (FIFO)
          if (entry.enqueuedAtMs < midEntry.enqueuedAtMs) {
            high = mid;
          } else {
            low = mid + 1;
          }
        }
      }
    }

    this.items.splice(low, 0, entry);
  }

  private reclaimExpiredInFlight(): void {
    const now = Date.now();
    for (const [handle, record] of this.inFlight.entries()) {
      if (record.expiresAtMs <= now) {
        this.inFlight.delete(handle);
        record.entry.visibleAfterMs = now;
        this.insertEntry(record.entry);
      }
    }
  }
}

