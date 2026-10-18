import type { JobPriority } from '../models/JobPriority.js';
import type { QueueMessage } from './QueueMessage.js';

export interface IJobQueue {
  enqueue(jobId: string, priority?: JobPriority, delayMs?: number): Promise<string>;
  dequeue(visibilityTimeoutMs?: number): Promise<QueueMessage | null>;
  acknowledge(receiptHandle: string): Promise<boolean>;
  reject(receiptHandle: string, requeue?: boolean): Promise<boolean>;
  requeue(receiptHandle: string, delayMs?: number): Promise<boolean>;
  inspect(limit?: number): Promise<readonly QueueMessage[]>;
  getDepth(): Promise<number>;
  clear(): Promise<void>;
}

export const IJobQueueToken = Symbol('IJobQueue');
