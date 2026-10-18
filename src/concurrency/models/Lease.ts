export interface Lease {
  readonly leaseId: string;
  readonly resourceId: string;
  readonly holderId: string;
  readonly acquiredAt: number;
  readonly expiresAt: number;
  readonly renewCount: number;
  readonly ttlMs: number;
  readonly scope: string;
}

export interface LeaseOptions {
  readonly ttlMs?: number | undefined;
  readonly scope?: string | undefined;
}
