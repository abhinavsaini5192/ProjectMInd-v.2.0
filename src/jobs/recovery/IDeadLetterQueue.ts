import type { JobType } from '../models/JobType.js';

export interface DeadLetterRecord {
  readonly deadLetterId: string;
  readonly jobId: string;
  readonly type: JobType;
  readonly workspaceId: string;
  readonly repositoryId?: string | undefined;
  readonly failureReason: string;
  readonly errorCode?: string | undefined;
  readonly retryCount: number;
  readonly deadLetteredAt: string;
  readonly correlationId?: string | undefined;
  readonly payload?: Record<string, unknown> | undefined;
}

export interface IDeadLetterQueue {
  record(entry: Omit<DeadLetterRecord, 'deadLetterId' | 'deadLetteredAt'>): Promise<DeadLetterRecord>;
  get(jobId: string): Promise<DeadLetterRecord | null>;
  list(workspaceId?: string, limit?: number): Promise<readonly DeadLetterRecord[]>;
  remove(jobId: string): Promise<boolean>;
  getDepth(): Promise<number>;
  clear(): Promise<void>;
}

export const IDeadLetterQueueToken = Symbol('IDeadLetterQueue');
