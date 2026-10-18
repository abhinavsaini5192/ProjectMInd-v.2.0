export interface DistributedLock {
  /** Unique resource key protected by this lock */
  readonly lockKey: string;
  /** Unique owner token identifying the acquiring instance or client process */
  readonly ownerId: string;
  /** Monotonically increasing fencing token protecting against stale clients */
  readonly fencingToken: number;
  /** Epoch timestamp when lock was acquired */
  readonly acquiredAt: number;
  /** Epoch timestamp when lock expires if not renewed */
  readonly expiresAt: number;
  /** Lease duration in milliseconds */
  readonly ttlMs: number;
  /** Number of times this lock lease was successfully renewed */
  readonly renewCount: number;
  /** Context or purpose metadata */
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface LockAcquireOptions {
  /** Time to live for the lock lease in milliseconds (default: 30000) */
  readonly ttlMs?: number | undefined;
  /** Maximum time to wait for lock acquisition in milliseconds (default: 10000) */
  readonly waitTimeoutMs?: number | undefined;
  /** Retry backoff delay between acquisition attempts in milliseconds (default: 100) */
  readonly retryIntervalMs?: number | undefined;
  /** Context or purpose metadata associated with the lock */
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export type LockAcquireResult =
  | { readonly success: true; readonly lock: DistributedLock }
  | { readonly success: false; readonly error: string; readonly currentLock?: DistributedLock | null };
