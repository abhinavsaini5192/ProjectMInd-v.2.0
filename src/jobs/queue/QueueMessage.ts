import type { JobPriority } from '../models/JobPriority.js';

export interface QueueMessage {
  readonly messageId: string;
  readonly jobId: string;
  readonly priority: JobPriority;
  readonly receiptHandle: string;
  readonly deliveryCount: number;
  readonly enqueuedAt: string;
  readonly visibleAfterMs: number;
}
