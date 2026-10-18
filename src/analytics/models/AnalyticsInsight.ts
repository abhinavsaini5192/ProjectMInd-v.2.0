import type { AnalyticsCategory } from './AnalyticsCategory.js';
import type { AnalyticsScopeRef } from './AnalyticsScope.js';
import type { TimeWindow } from './AnalyticsSnapshot.js';

export type InsightSeverity = 'INFO' | 'WARNING' | 'CRITICAL' | 'OPPORTUNITY';

export interface InsightEvidenceReference {
  readonly metricId: string;
  readonly observedValue: number;
  readonly expectedOrThreshold?: number | undefined;
  readonly recordIds?: readonly string[] | undefined;
}

export interface AnalyticsInsight {
  readonly insightId: string;
  readonly title: string;
  readonly category: AnalyticsCategory;
  readonly severity: InsightSeverity;
  readonly pattern: string;
  readonly baseline?: string | undefined;
  readonly timeWindow: TimeWindow;
  readonly scope: AnalyticsScopeRef;
  readonly evidenceReferences: readonly InsightEvidenceReference[];
  readonly confidence: number; // 0.0 - 1.0
  readonly recommendation: string;
  readonly generatedAt: number;
}
