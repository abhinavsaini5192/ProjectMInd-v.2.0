export type FeatureHistorySourceProvenance =
  | 'OBSERVED'
  | 'DERIVED'
  | 'INFERRED'
  | 'IMPORTED'
  | 'UNKNOWN';

export type FeatureHistorySourceType =
  | 'LIFECYCLE'
  | 'MAPPING'
  | 'DEPENDENCY'
  | 'BEHAVIOR'
  | 'HEALTH'
  | 'RISK'
  | 'IMPACT'
  | 'ARCHITECTURE'
  | 'STATUS'
  | 'DISCOVERY'
  | 'REPOSITORY'
  | 'MANUAL'
  | 'UNKNOWN';

export interface FeatureHistorySourceRef {
  system: FeatureHistorySourceType;
  provenance: FeatureHistorySourceProvenance;
  referenceId?: string | undefined;
  details?: Record<string, any> | undefined;
}
