import { randomUUID } from 'crypto';
import type { Lease, LeaseOptions } from '../models/Lease.js';
import type { ICoordinationService } from './ICoordinationService.js';

export class CoordinationService implements ICoordinationService {
  private readonly leasesByResource = new Map<string, Lease>();
  private readonly leasesById = new Map<string, Lease>();
  private readonly versions = new Map<string, number>();
  private readonly defaultTtlMs: number;

  constructor(options: { defaultTtlMs?: number } = {}) {
    this.defaultTtlMs = options.defaultTtlMs ?? 30000;
  }

  public async acquireLease(
    resourceId: string,
    holderId: string,
    options: LeaseOptions = {}
  ): Promise<Lease | null> {
    const now = Date.now();
    const ttlMs = options.ttlMs ?? this.defaultTtlMs;
    const existing = this.leasesByResource.get(resourceId);

    if (existing) {
      if (existing.expiresAt > now) {
        if (existing.holderId === holderId) {
          // Re-entry / self-renewal
          const updated: Lease = {
            ...existing,
            expiresAt: now + ttlMs,
            renewCount: existing.renewCount + 1,
            ttlMs,
          };
          this.leasesByResource.set(resourceId, updated);
          this.leasesById.set(existing.leaseId, updated);
          return updated;
        }
        return null;
      }
      // Stale lease: purge
      this.leasesByResource.delete(resourceId);
      this.leasesById.delete(existing.leaseId);
    }

    const leaseId = `lease-${randomUUID()}`;
    const newLease: Lease = {
      leaseId,
      resourceId,
      holderId,
      acquiredAt: now,
      expiresAt: now + ttlMs,
      renewCount: 0,
      ttlMs,
      scope: options.scope ?? 'coordination',
    };

    this.leasesByResource.set(resourceId, newLease);
    this.leasesById.set(leaseId, newLease);
    return newLease;
  }

  public async renewLease(leaseId: string, holderId: string, ttlMs?: number): Promise<boolean> {
    const existing = this.leasesById.get(leaseId);
    if (!existing) return false;

    const now = Date.now();
    if (existing.expiresAt <= now) {
      this.leasesByResource.delete(existing.resourceId);
      this.leasesById.delete(leaseId);
      return false;
    }

    if (existing.holderId !== holderId) return false;

    const duration = ttlMs ?? existing.ttlMs;
    const updated: Lease = {
      ...existing,
      expiresAt: now + duration,
      renewCount: existing.renewCount + 1,
      ttlMs: duration,
    };

    this.leasesByResource.set(existing.resourceId, updated);
    this.leasesById.set(leaseId, updated);
    return true;
  }

  public async releaseLease(leaseId: string, holderId: string): Promise<boolean> {
    const existing = this.leasesById.get(leaseId);
    if (!existing) return false;

    if (existing.holderId !== holderId) return false;

    this.leasesById.delete(leaseId);
    this.leasesByResource.delete(existing.resourceId);
    return true;
  }

  public async getLease(resourceId: string): Promise<Lease | null> {
    const lease = this.leasesByResource.get(resourceId);
    if (!lease) return null;

    if (lease.expiresAt <= Date.now()) {
      this.leasesByResource.delete(resourceId);
      this.leasesById.delete(lease.leaseId);
      return null;
    }

    return lease;
  }

  public async compareAndSet(
    resourceId: string,
    expectedVersion: number,
    newVersion: number
  ): Promise<boolean> {
    const current = this.versions.get(resourceId) ?? 0;
    if (current === expectedVersion) {
      this.versions.set(resourceId, newVersion);
      return true;
    }
    return false;
  }

  public async getVersion(resourceId: string): Promise<number> {
    return this.versions.get(resourceId) ?? 0;
  }
}
