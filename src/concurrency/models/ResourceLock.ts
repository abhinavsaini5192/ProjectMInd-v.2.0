export interface ResourceLock {
  readonly lockId: string;
  readonly resourceKey: string;
  readonly ownerId: string;
  readonly acquiredAt: number;
  readonly expiresAt: number;
  readonly ttlMs: number;
  readonly purpose: string;
  readonly correlationId?: string | undefined;
  readonly workspaceId: string;
  readonly repositoryId?: string | undefined;
  readonly featureId?: string | undefined;
}

export interface LockAcquisitionOptions {
  readonly ttlMs?: number | undefined;
  readonly waitTimeoutMs?: number | undefined;
  readonly purpose?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly featureId?: string | undefined;
}
