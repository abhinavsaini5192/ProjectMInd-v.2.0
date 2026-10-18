import type { Lease, LeaseOptions } from '../models/Lease.js';

export interface ICoordinationService {
  /**
   * Acquires a lease on a shared coordination resource.
   */
  acquireLease(resourceId: string, holderId: string, options?: LeaseOptions): Promise<Lease | null>;

  /**
   * Renews an existing lease.
   */
  renewLease(leaseId: string, holderId: string, ttlMs?: number): Promise<boolean>;

  /**
   * Releases an active lease.
   */
  releaseLease(leaseId: string, holderId: string): Promise<boolean>;

  /**
   * Inspects current lease on a resource.
   */
  getLease(resourceId: string): Promise<Lease | null>;

  /**
   * Atomic Compare-and-Set operation on an integer version counter.
   */
  compareAndSet(resourceId: string, expectedVersion: number, newVersion: number): Promise<boolean>;

  /**
   * Gets current version for a resource.
   */
  getVersion(resourceId: string): Promise<number>;
}
