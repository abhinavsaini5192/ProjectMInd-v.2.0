import type { IJobLeaseManager } from './IJobLeaseManager.js';
import type { IDistributedCoordinationBackend } from '../../distributed/coordination/IDistributedCoordinationBackend.js';
import type { DistributedLock } from '../../distributed/models/DistributedLock.js';

export class DistributedJobLeaseManager implements IJobLeaseManager {
  private readonly backend: IDistributedCoordinationBackend;
  private readonly activeLocks = new Map<string, DistributedLock>();

  constructor(backend: IDistributedCoordinationBackend) {
    this.backend = backend;
  }

  private leaseKey(jobId: string): string {
    return `job:lease:${jobId}`;
  }

  public async acquireLease(jobId: string, workerId: string, ttlMs: number): Promise<boolean> {
    const key = this.leaseKey(jobId);
    try {
      const lock = await this.backend.acquireLock(key, workerId, ttlMs);
      if (lock) {
        this.activeLocks.set(jobId, lock);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  public async renewLease(jobId: string, workerId: string, ttlMs: number): Promise<boolean> {
    const key = this.leaseKey(jobId);
    const existing = this.activeLocks.get(jobId);
    const fencingToken = existing ? existing.fencingToken : 1;

    try {
      const renewed = await this.backend.renewLock(key, workerId, fencingToken, ttlMs);
      if (renewed && existing) {
        this.activeLocks.set(jobId, {
          ...existing,
          expiresAt: Date.now() + ttlMs,
          renewCount: existing.renewCount + 1,
        });
      }
      return renewed;
    } catch {
      return false;
    }
  }

  public async releaseLease(jobId: string, workerId: string): Promise<boolean> {
    const key = this.leaseKey(jobId);
    const existing = this.activeLocks.get(jobId);
    const fencingToken = existing ? existing.fencingToken : 1;

    try {
      const released = await this.backend.releaseLock(key, workerId, fencingToken);
      this.activeLocks.delete(jobId);
      return released;
    } catch {
      return false;
    }
  }

  public async getLeaseHolder(jobId: string): Promise<string | null> {
    const key = this.leaseKey(jobId);
    try {
      const lock = await this.backend.inspectLock(key);
      if (!lock) return null;
      if (lock.expiresAt <= Date.now()) return null;
      return lock.ownerId;
    } catch {
      return null;
    }
  }

  public async getExpiredJobIds(): Promise<readonly string[]> {
    const now = Date.now();
    const expired: string[] = [];

    for (const [jobId, lock] of this.activeLocks.entries()) {
      if (lock.expiresAt <= now) {
        expired.push(jobId);
      }
    }

    return expired;
  }

  public async clear(): Promise<void> {
    this.activeLocks.clear();
  }
}
