export type ContextFreshnessStatus = 'CURRENT' | 'RECENT' | 'STALE' | 'VERSION_MISMATCH' | 'UNKNOWN';

export interface ContextFreshness {
  status: ContextFreshnessStatus;
  isStale: boolean;
  lastUpdatedAt?: number | undefined;
  lastVerifiedAt?: number | undefined;
  ageMs?: number | undefined;
  invalidationReasons: string[];
  staleReasons?: string[] | undefined;
}
