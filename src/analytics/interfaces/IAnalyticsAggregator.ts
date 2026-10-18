import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';
import type { TimeWindow, AnalyticsSnapshot } from '../models/AnalyticsSnapshot.js';
import type {
  AnalyticsQueryResult,
  HistoricalComparisonQuery,
  HistoricalComparisonResult,
} from '../models/AnalyticsQuery.js';

export interface IAnalyticsAggregator {
  aggregate(
    scope: AnalyticsScopeRef,
    window: TimeWindow,
    metricIds?: readonly string[]
  ): Promise<AnalyticsQueryResult>;
  generateSnapshot(scope: AnalyticsScopeRef, window: TimeWindow): Promise<AnalyticsSnapshot>;
  compareWindows(query: HistoricalComparisonQuery): Promise<HistoricalComparisonResult>;
}

export const IAnalyticsAggregatorToken = Symbol('IAnalyticsAggregator');
