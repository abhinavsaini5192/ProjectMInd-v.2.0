import type { Job } from '../models/Job.js';
import type { JobStatus } from '../models/JobStatus.js';

export interface IJobRepository {
  save(job: Job): Promise<Job>;
  getById(jobId: string): Promise<Job | null>;
  getByIdempotencyKey(key: string, workspaceId: string): Promise<Job | null>;
  update(jobId: string, updates: Partial<Job>): Promise<Job | null>;
  listByStatus(status: JobStatus, limit?: number): Promise<readonly Job[]>;
  listByWorkspace(workspaceId: string, limit?: number): Promise<readonly Job[]>;
  delete(jobId: string): Promise<boolean>;
  clear(): Promise<void>;
}

export const IJobRepositoryToken = Symbol('IJobRepository');
