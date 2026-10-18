import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';
import type { TimeWindow, MetricAggregateResult } from '../models/AnalyticsSnapshot.js';
import type { AnalyticsInsight } from '../models/AnalyticsInsight.js';

export interface IAnalyticsInsightEngine {
  generateInsights(
    scope: AnalyticsScopeRef,
    window: TimeWindow,
    metrics: Record<string, MetricAggregateResult>
  ): readonly AnalyticsInsight[];
}

export const IAnalyticsInsightEngineToken = Symbol('IAnalyticsInsightEngine');
