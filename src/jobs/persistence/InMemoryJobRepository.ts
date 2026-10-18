import type { IJobRepository } from './IJobRepository.js';
import type { Job } from '../models/Job.js';
import type { JobStatus } from '../models/JobStatus.js';

export class InMemoryJobRepository implements IJobRepository {
  private readonly jobs = new Map<string, Job>();
  private readonly idempotencyIndex = new Map<string, string>(); // `${workspaceId}:${key}` -> jobId

  public async save(job: Job): Promise<Job> {
    this.jobs.set(job.jobId, job);
    if (job.idempotencyKey) {
      this.idempotencyIndex.set(`${job.workspaceId}:${job.idempotencyKey}`, job.jobId);
    }
    return job;
  }

  public async getById(jobId: string): Promise<Job | null> {
    return this.jobs.get(jobId) ?? null;
  }

  public async getByIdempotencyKey(key: string, workspaceId: string): Promise<Job | null> {
    const jobId = this.idempotencyIndex.get(`${workspaceId}:${key}`);
    if (!jobId) return null;
    return this.getById(jobId);
  }

  public async update(jobId: string, updates: Partial<Job>): Promise<Job | null> {
    const existing = this.jobs.get(jobId);
    if (!existing) return null;

    const updated: Job = {
      ...existing,
      ...updates,
      version: existing.version + 1,
    };

    this.jobs.set(jobId, updated);
    return updated;
  }

  public async listByStatus(status: JobStatus, limit: number = 50): Promise<readonly Job[]> {
    const result: Job[] = [];
    for (const job of this.jobs.values()) {
      if (job.status === status) {
        result.push(job);
        if (result.length >= limit) break;
      }
    }
    return result;
  }

  public async listByWorkspace(workspaceId: string, limit: number = 50): Promise<readonly Job[]> {
    const result: Job[] = [];
    for (const job of this.jobs.values()) {
      if (job.workspaceId === workspaceId) {
        result.push(job);
        if (result.length >= limit) break;
      }
    }
    return result;
  }

  public async delete(jobId: string): Promise<boolean> {
    const existing = this.jobs.get(jobId);
    if (existing && existing.idempotencyKey) {
      this.idempotencyIndex.delete(`${existing.workspaceId}:${existing.idempotencyKey}`);
    }
    return this.jobs.delete(jobId);
  }

  public async clear(): Promise<void> {
    this.jobs.clear();
    this.idempotencyIndex.clear();
  }
}
