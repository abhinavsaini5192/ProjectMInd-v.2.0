export type FreshnessStatus =
  | 'CURRENT'
  | 'RECENT'
  | 'STALE'
  | 'UNKNOWN'
  | 'NOT_AVAILABLE'
  | 'VERSION_MISMATCH';

export interface FeatureKnowledgeFreshness {
  status: FreshnessStatus;
  lastUpdatedAt?: number | undefined;
  sourceKnowledgeVersion?: string | undefined;
  invalidationReason?: string | undefined;
  ageMs?: number | undefined;
}
