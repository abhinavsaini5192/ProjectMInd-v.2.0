import type { Job } from '../models/Job.js';
import type { JobResult } from '../models/JobResult.js';
import type { JobProgress } from '../models/JobProgress.js';

export interface JobExecutionContext {
  readonly signal: AbortSignal;
  readonly workerId: string;
  updateProgress(completed: number, total: number, message?: string): Promise<void>;
  log(message: string, details?: Record<string, unknown>): void;
}

export interface IJobHandler<TPayload = Record<string, unknown>> {
  validate(job: Job<TPayload>): Promise<void> | void;
  execute(job: Job<TPayload>, context: JobExecutionContext): Promise<Omit<JobResult, 'jobId' | 'status' | 'completedAt'>>;
}
