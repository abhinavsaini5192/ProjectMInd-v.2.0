import type { ResourceLock, LockAcquisitionOptions } from '../models/ResourceLock.js';
import type { LockResult } from './LockResult.js';

export interface IResourceLockManager {
  /**
   * Attempts to acquire an exclusive lock on the specified resource.
   */
  acquire(resourceKey: string, ownerId: string, options?: LockAcquisitionOptions): Promise<LockResult>;

  /**
   * Renews an existing lock if the owner matches and the lock has not expired.
   */
  renew(lockId: string, ownerId: string, ttlMs?: number): Promise<boolean>;

  /**
   * Releases an existing lock if the owner matches.
   */
  release(lockId: string, ownerId: string): Promise<boolean>;

  /**
   * Inspects current lock metadata on a resource without modifying it.
   */
  inspect(resourceKey: string): Promise<ResourceLock | null>;

  /**
   * Returns true if the resource is actively locked by a non-expired lock.
   */
  isLocked(resourceKey: string): Promise<boolean>;

  /**
   * Administrative/Recovery force-release of a lock.
   */
  forceRelease(resourceKey: string, reason: string): Promise<boolean>;

  /**
   * Returns all currently active (non-expired) locks.
   */
  getActiveLocks(): Promise<ResourceLock[]>;

  /**
   * Cleans up expired locks and returns their keys.
   */
  purgeExpired(): Promise<string[]>;
}
