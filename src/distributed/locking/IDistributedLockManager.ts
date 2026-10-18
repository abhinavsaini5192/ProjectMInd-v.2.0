import type { DistributedLock, LockAcquireOptions, LockAcquireResult } from '../models/DistributedLock.js';

export interface LockMetrics {
  readonly totalAcquisitionAttempts: number;
  readonly successfulAcquisitions: number;
  readonly failedAcquisitions: number;
  readonly totalRenewals: number;
  readonly totalReleases: number;
  readonly averageAcquisitionLatencyMs: number;
  readonly activeLocksCount: number;
}

export interface IDistributedLockManager {
  /**
   * Attempts to acquire an exclusive lock with bounded wait timeout and automatic retry.
   */
  acquire(resourceKey: string, options?: LockAcquireOptions): Promise<LockAcquireResult>;

  /**
   * Renews an existing lock lease before it expires.
   */
  renew(lock: DistributedLock, extensionMs?: number): Promise<boolean>;

  /**
   * Releases an actively held lock with owner and fencing verification.
   */
  release(lock: DistributedLock): Promise<boolean>;

  /**
   * Executes a critical operation inside a distributed lock, automatically releasing on finish or error.
   */
  withLock<T>(
    resourceKey: string,
    operation: (lock: DistributedLock) => Promise<T>,
    options?: LockAcquireOptions
  ): Promise<T>;

  /**
   * Inspects the current lock metadata on a resource.
   */
  inspect(resourceKey: string): Promise<DistributedLock | null>;

  /**
   * Checks whether a resource is actively locked by a non-expired lease.
   */
  isLocked(resourceKey: string): Promise<boolean>;

  /**
   * Administrative/Recovery force-release.
   */
  forceRelease(resourceKey: string): Promise<boolean>;

  /**
   * Returns operational metrics for lock contention, latency, and throughput.
   */
  getMetrics(): LockMetrics;

  /**
   * Shuts down any active renewal timers and cleans up resources.
   */
  close(): Promise<void>;
}

export const IDistributedLockManagerToken = Symbol.for('IDistributedLockManager');
