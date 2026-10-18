import type { ResourceLock } from '../models/ResourceLock.js';

export type LockErrorCode =
  | 'LOCK_CONTENDED'
  | 'LOCK_EXPIRED'
  | 'UNAUTHORIZED'
  | 'TIMEOUT'
  | 'INVALID_SCOPE';

export interface LockResult {
  readonly success: boolean;
  readonly lock?: ResourceLock | undefined;
  readonly error?: LockErrorCode | undefined;
  readonly currentOwner?: string | undefined;
  readonly remainingTtlMs?: number | undefined;
}
