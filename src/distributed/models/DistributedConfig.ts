export type DistributedMode = 'standalone' | 'distributed';
export type CoordinationBackendType = 'memory' | 'file_shared' | 'redis';
export type ServiceRole = 'API' | 'WORKER' | 'COORDINATOR' | 'HYBRID';

export interface DistributedConfig {
  /** Runtime execution mode: standalone (single-instance) or distributed (multi-instance) */
  readonly mode: DistributedMode;
  /** Shared coordination backend provider */
  readonly backend: CoordinationBackendType;
  /** Unique instance identifier (defaults to host-pid-random if not provided) */
  readonly instanceId?: string | undefined;
  /** Service role for this runtime instance */
  readonly role: ServiceRole;
  /** Shared directory path for file_shared backend (e.g. .projectmind/coordination) */
  readonly sharedDirectory?: string | undefined;
  /** Redis connection URL if using redis backend (e.g. redis://127.0.0.1:6379) */
  readonly redisUrl?: string | undefined;
  /** Heartbeat interval in milliseconds for service discovery renewal (default: 5000ms) */
  readonly heartbeatIntervalMs: number;
  /** Time in milliseconds after which an unrenewed instance is considered stale/dead (default: 15000ms) */
  readonly staleThresholdMs: number;
  /** Default lock lease time-to-live in milliseconds (default: 30000ms) */
  readonly defaultLockTtlMs: number;
  /** Maximum wait timeout for lock acquisition in milliseconds (default: 10000ms) */
  readonly acquireTimeoutMs: number;
  /** Interval in milliseconds between lock acquisition retries (default: 100ms) */
  readonly retryIntervalMs: number;
  /** Maximum duration to wait for in-flight tasks to drain during graceful shutdown (default: 10000ms) */
  readonly shutdownTimeoutMs: number;
  /** Enables cluster-wide event broadcasting across instances (default: true) */
  readonly distributedEventsEnabled: boolean;
}

export const DEFAULT_DISTRIBUTED_CONFIG: DistributedConfig = {
  mode: 'standalone',
  backend: 'memory',
  role: 'HYBRID',
  heartbeatIntervalMs: 5000,
  staleThresholdMs: 15000,
  defaultLockTtlMs: 30000,
  acquireTimeoutMs: 10000,
  retryIntervalMs: 100,
  shutdownTimeoutMs: 10000,
  distributedEventsEnabled: true,
};
