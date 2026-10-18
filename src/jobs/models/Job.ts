import type { JobType } from './JobType.js';
import type { JobStatus } from './JobStatus.js';
import type { JobPriority } from './JobPriority.js';
import type { JobResult } from './JobResult.js';
import type { JobProgress } from './JobProgress.js';
import type { JobErrorDetails } from './JobError.js';

export interface CreateJobParams<T = Record<string, unknown>> {
  readonly type: JobType;
  readonly workspaceId: string;
  readonly organizationId?: string | undefined;
  readonly payload: T;
  readonly repositoryId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly priority?: JobPriority | undefined;
  readonly maxRetries?: number | undefined;
  readonly timeoutMs?: number | undefined;
  readonly idempotencyKey?: string | undefined;
  readonly parentJobId?: string | undefined;
  readonly dependencies?: readonly string[] | undefined;
  readonly scheduledAt?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly traceId?: string | undefined;
}

export interface Job<T = Record<string, unknown>> {
  readonly jobId: string;
  readonly type: JobType;
  readonly status: JobStatus;
  readonly priority: JobPriority;
  readonly workspaceId: string;
  readonly organizationId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly traceId?: string | undefined;
  readonly createdAt: string;
  readonly scheduledAt?: string | undefined;
  readonly startedAt?: string | undefined;
  readonly completedAt?: string | undefined;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly timeoutMs: number;
  readonly idempotencyKey?: string | undefined;
  readonly parentJobId?: string | undefined;
  readonly dependencies?: readonly string[] | undefined;
  readonly payload: Readonly<T>;
  readonly result?: JobResult | undefined;
  readonly error?: JobErrorDetails | undefined;
  readonly progress?: JobProgress | undefined;
  readonly workerId?: string | undefined;
  readonly fencingToken?: number | undefined;
  readonly version: number;
}
