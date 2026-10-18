export const AnalyticsTokens = {
  IMetricRegistry: Symbol.for('Analytics.IMetricRegistry'),
  IAnalyticsStore: Symbol.for('Analytics.IAnalyticsStore'),
  IAnalyticsCollector: Symbol.for('Analytics.IAnalyticsCollector'),
  IAnalyticsAggregator: Symbol.for('Analytics.IAnalyticsAggregator'),
  IAnalyticsInsightEngine: Symbol.for('Analytics.IAnalyticsInsightEngine'),
  IAnalyticsReportService: Symbol.for('Analytics.IAnalyticsReportService'),
  IAnalyticsService: Symbol.for('Analytics.IAnalyticsService'),
  EventBusAnalyticsBridge: Symbol.for('Analytics.EventBusAnalyticsBridge'),
  AuditAnalyticsBridge: Symbol.for('Analytics.AuditAnalyticsBridge'),
} as const;
