export type VersionConsistencyStatus =
  | 'CONSISTENT'
  | 'PARTIALLY_CONSISTENT'
  | 'INCONSISTENT'
  | 'UNKNOWN';

export interface FeatureKnowledgeVersion {
  aggregateVersion: string;
  consistencyStatus: VersionConsistencyStatus;
  sectionVersions: Record<string, string>;
  mismatches: string[];
}
