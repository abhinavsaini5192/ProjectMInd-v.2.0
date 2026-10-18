import type { DistributedLock } from '../models/DistributedLock.js';

export interface BackendHealth {
  readonly healthy: boolean;
  readonly message: string;
  readonly latencyMs: number;
}

export interface BackendSubscription {
  unsubscribe(): Promise<void>;
}

export interface IDistributedCoordinationBackend {
  /** Attempts to acquire an atomic distributed lock */
  acquireLock(
    key: string,
    ownerId: string,
    ttlMs: number,
    metadata?: Record<string, unknown>
  ): Promise<DistributedLock | null>;

  /** Renews an active lock if caller owns the current lease and fencing token matches */
  renewLock(
    key: string,
    ownerId: string,
    fencingToken: number,
    ttlMs: number
  ): Promise<boolean>;

  /** Safely releases a lock only if ownerId and fencingToken match current lease */
  releaseLock(
    key: string,
    ownerId: string,
    fencingToken: number
  ): Promise<boolean>;

  /** Inspects lock status on key */
  inspectLock(key: string): Promise<DistributedLock | null>;

  /** Force releases a lock for administrative recovery */
  forceRelease(key: string): Promise<boolean>;

  /** Atomic set if not exists (CAS primitive) with optional TTL */
  setNx(key: string, value: string, ttlMs?: number): Promise<boolean>;

  /** Sets key to value with optional TTL */
  set(key: string, value: string, ttlMs?: number): Promise<void>;

  /** Gets value for key */
  get(key: string): Promise<string | null>;

  /** Deletes key */
  delete(key: string): Promise<boolean>;

  /** Lists keys matching a prefix */
  listKeys(prefix: string): Promise<string[]>;

  /** Publishes a message to a cluster channel */
  publish(channel: string, message: string): Promise<number>;

  /** Subscribes to messages on a cluster channel */
  subscribe(
    channel: string,
    handler: (message: string) => void
  ): Promise<BackendSubscription>;

  /** Checks connectivity and health of the coordination backend */
  healthCheck(): Promise<BackendHealth>;

  /** Closes any open connections, file descriptors, or timers */
  close(): Promise<void>;
}

export const IDistributedCoordinationBackendToken = Symbol.for('IDistributedCoordinationBackend');
