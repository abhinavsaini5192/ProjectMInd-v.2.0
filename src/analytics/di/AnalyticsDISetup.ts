import type { DIContainer } from '../../workspace/di/DIContainer.js';
import { AnalyticsTokens } from './AnalyticsTokens.js';
import { MetricRegistry } from '../registry/MetricRegistry.js';
import { InMemoryAnalyticsStore } from '../storage/InMemoryAnalyticsStore.js';
import { AnalyticsCollector } from '../collection/AnalyticsCollector.js';
import { EventBusAnalyticsBridge } from '../collection/EventBusAnalyticsBridge.js';
import { AuditAnalyticsBridge } from '../collection/AuditAnalyticsBridge.js';
import { AnalyticsAggregator } from '../aggregation/AnalyticsAggregator.js';
import { DeterministicInsightEngine } from '../insights/DeterministicInsightEngine.js';
import { AnalyticsReportService } from '../reports/AnalyticsReportService.js';
import { AnalyticsService } from '../services/AnalyticsService.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import type { IPersistentAuditStore } from '../../storage/repositories/PersistentAuditStore.js';
import type { IMetricsRegistry } from '../../observability/metrics/MetricTypes.js';

export interface AnalyticsDISetupDependencies {
  readonly eventBus?: IEventBus | undefined;
  readonly auditStore?: IPersistentAuditStore | undefined;
  readonly operationalMetrics?: IMetricsRegistry | undefined;
}

export class AnalyticsDISetup {
  public static register(
    container: DIContainer,
    deps: AnalyticsDISetupDependencies = {}
  ): AnalyticsService {
    // 1. Metric Registry
    const metricRegistry = new MetricRegistry(deps.eventBus);
    container.registerFactory(AnalyticsTokens.IMetricRegistry, () => metricRegistry, 'Singleton');

    // 2. Storage
    const store = new InMemoryAnalyticsStore();
    container.registerFactory(AnalyticsTokens.IAnalyticsStore, () => store, 'Singleton');

    // 3. Collector
    const collector = new AnalyticsCollector(store, metricRegistry, deps.eventBus);
    container.registerFactory(AnalyticsTokens.IAnalyticsCollector, () => collector, 'Singleton');

    // 4. Bridges
    if (deps.eventBus) {
      const eventBridge = new EventBusAnalyticsBridge(deps.eventBus, collector);
      eventBridge.attach();
      container.registerFactory(AnalyticsTokens.EventBusAnalyticsBridge, () => eventBridge, 'Singleton');
    }

    if (deps.auditStore) {
      const auditBridge = new AuditAnalyticsBridge(deps.auditStore, collector);
      container.registerFactory(AnalyticsTokens.AuditAnalyticsBridge, () => auditBridge, 'Singleton');
    }

    // 5. Aggregator
    const aggregator = new AnalyticsAggregator(
      store,
      metricRegistry,
      deps.operationalMetrics,
      deps.eventBus
    );
    container.registerFactory(AnalyticsTokens.IAnalyticsAggregator, () => aggregator, 'Singleton');

    // 6. Insight Engine
    const insightEngine = new DeterministicInsightEngine();
    container.registerFactory(AnalyticsTokens.IAnalyticsInsightEngine, () => insightEngine, 'Singleton');

    // 7. Report Service
    const reportService = new AnalyticsReportService(
      store,
      aggregator,
      insightEngine,
      metricRegistry,
      deps.eventBus
    );
    container.registerFactory(AnalyticsTokens.IAnalyticsReportService, () => reportService, 'Singleton');

    // 8. Analytics Service facade
    const analyticsService = new AnalyticsService(
      metricRegistry,
      aggregator,
      reportService,
      insightEngine
    );
    container.registerFactory(AnalyticsTokens.IAnalyticsService, () => analyticsService, 'Singleton');

    return analyticsService;
  }
}
