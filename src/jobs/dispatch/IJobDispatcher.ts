import type { Job, CreateJobParams } from '../models/Job.js';

export interface IJobDispatcher {
  dispatch<T = Record<string, unknown>>(params: CreateJobParams<T>): Promise<Job<T>>;
  getJob(jobId: string): Promise<Job | null>;
  cancelJob(jobId: string, reason?: string): Promise<boolean>;
}

export const IJobDispatcherToken = Symbol('IJobDispatcher');
