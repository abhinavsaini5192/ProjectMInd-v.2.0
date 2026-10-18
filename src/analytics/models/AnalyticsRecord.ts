import type { AnalyticsScopeRef } from './AnalyticsScope.js';

export type AnalyticsSourceType =
  | 'EVENT_BUS'
  | 'AUDIT_LOG'
  | 'OPERATIONAL_METRIC'
  | 'DOMAIN_SERVICE'
  | 'DIRECT_OBSERVATION';

export interface AnalyticsRecord {
  readonly recordId: string;
  readonly metricId: string;
  readonly timestamp: number; // UTC ms epoch
  readonly scope: AnalyticsScopeRef;
  readonly value: number;
  readonly sourceType: AnalyticsSourceType;
  readonly sourceReference: string;
  readonly provenance?: {
    readonly actorId?: string | undefined;
    readonly correlationId?: string | undefined;
    readonly component?: string | undefined;
  } | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
