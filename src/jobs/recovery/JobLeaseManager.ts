import type { IJobLeaseManager, JobLease } from './IJobLeaseManager.js';

export class JobLeaseManager implements IJobLeaseManager {
  private readonly leases = new Map<string, JobLease>();

  public async acquireLease(jobId: string, workerId: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.leases.get(jobId);

    if (existing && existing.expiresAtMs > now) {
      if (existing.workerId === workerId) {
        existing.expiresAtMs = now + ttlMs;
        return true;
      }
      return false; // Active lease held by another worker
    }

    this.leases.set(jobId, {
      jobId,
      workerId,
      acquiredAtMs: now,
      expiresAtMs: now + ttlMs,
    });
    return true;
  }

  public async renewLease(jobId: string, workerId: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.leases.get(jobId);

    if (!existing || existing.workerId !== workerId || existing.expiresAtMs <= now) {
      return false;
    }

    existing.expiresAtMs = now + ttlMs;
    return true;
  }

  public async releaseLease(jobId: string, workerId: string): Promise<boolean> {
    const existing = this.leases.get(jobId);
    if (!existing || existing.workerId !== workerId) {
      return false;
    }
    return this.leases.delete(jobId);
  }

  public async getLeaseHolder(jobId: string): Promise<string | null> {
    const now = Date.now();
    const existing = this.leases.get(jobId);
    if (!existing || existing.expiresAtMs <= now) {
      return null;
    }
    return existing.workerId;
  }

  public async getExpiredJobIds(): Promise<readonly string[]> {
    const now = Date.now();
    const expired: string[] = [];

    for (const [jobId, lease] of this.leases.entries()) {
      if (lease.expiresAtMs <= now) {
        expired.push(jobId);
      }
    }
    return expired;
  }

  public async clear(): Promise<void> {
    this.leases.clear();
  }
}
