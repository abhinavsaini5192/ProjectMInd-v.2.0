export interface TaskLease {
  readonly taskId: string;
  readonly leaseOwner: string; // agentSessionId
  readonly acquiredAt: Date;
  readonly expiresAt: Date;
  readonly renewedAt?: Date | undefined;
}

export function isLeaseValid(lease?: TaskLease | undefined, now: Date = new Date()): boolean {
  if (!lease) return false;
  return lease.expiresAt.getTime() > now.getTime();
}
