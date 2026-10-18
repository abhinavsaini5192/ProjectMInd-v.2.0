export type VerificationFreshnessStatus =
  | 'CURRENT'
  | 'STALE'
  | 'PARTIALLY_STALE'
  | 'UNKNOWN';

export interface VerificationFreshness {
  readonly status: VerificationFreshnessStatus;
  readonly staleReason?: string | undefined;
  readonly evaluatedAt: string;
  readonly invalidatedBy?: readonly string[] | undefined;
}

export function isVerificationFresh(freshness: VerificationFreshness): boolean {
  return freshness.status === 'CURRENT';
}
