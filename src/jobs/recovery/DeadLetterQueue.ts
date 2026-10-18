import { randomUUID } from 'node:crypto';
import type { IDeadLetterQueue, DeadLetterRecord } from './IDeadLetterQueue.js';

export interface DeadLetterQueueOptions {
  readonly maxCapacity?: number | undefined;
}

export class DeadLetterQueue implements IDeadLetterQueue {
  private readonly records = new Map<string, DeadLetterRecord>();
  private readonly maxCapacity: number;

  constructor(options: DeadLetterQueueOptions = {}) {
    this.maxCapacity = options.maxCapacity ?? 5000;
  }

  public async record(entry: Omit<DeadLetterRecord, 'deadLetterId' | 'deadLetteredAt'>): Promise<DeadLetterRecord> {
    const deadLetterId = randomUUID();
    const record: DeadLetterRecord = {
      deadLetterId,
      jobId: entry.jobId,
      type: entry.type,
      workspaceId: entry.workspaceId,
      repositoryId: entry.repositoryId,
      failureReason: entry.failureReason,
      errorCode: entry.errorCode,
      retryCount: entry.retryCount,
      deadLetteredAt: new Date().toISOString(),
      correlationId: entry.correlationId,
      payload: entry.payload,
    };

    if (this.records.size >= this.maxCapacity) {
      const oldestKey = this.records.keys().next().value;
      if (oldestKey) this.records.delete(oldestKey);
    }

    this.records.set(entry.jobId, record);
    return record;
  }

  public async get(jobId: string): Promise<DeadLetterRecord | null> {
    return this.records.get(jobId) ?? null;
  }

  public async list(workspaceId?: string, limit: number = 50): Promise<readonly DeadLetterRecord[]> {
    const result: DeadLetterRecord[] = [];
    for (const record of this.records.values()) {
      if (!workspaceId || record.workspaceId === workspaceId) {
        result.push(record);
        if (result.length >= limit) break;
      }
    }
    return result;
  }

  public async remove(jobId: string): Promise<boolean> {
    return this.records.delete(jobId);
  }

  public async getDepth(): Promise<number> {
    return this.records.size;
  }

  public async clear(): Promise<void> {
    this.records.clear();
  }
}
