export type DataQualityStatus = 'HEALTHY' | 'DEGRADED' | 'INCOMPLETE' | 'STALE' | 'UNKNOWN';

export interface AnalyticsDataQuality {
  readonly status: DataQualityStatus;
  readonly coverageRatio: number; // 0.0 to 1.0
  readonly warnings: readonly string[];
  readonly missingMetrics: readonly string[];
  readonly staleSources: readonly string[];
  readonly evaluatedAt: number;
}
