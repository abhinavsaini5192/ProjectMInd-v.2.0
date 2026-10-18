import type { IAnalyticsCollector } from '../interfaces/IAnalyticsCollector.js';
import type { IAnalyticsStore } from '../interfaces/IAnalyticsStore.js';
import type { IMetricRegistry } from '../interfaces/IMetricRegistry.js';
import type { AnalyticsRecord } from '../models/AnalyticsRecord.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { ANALYTICS_EVENT_NAMES } from '../events/AnalyticsEvents.js';
import { MetricNotFoundError } from '../errors/AnalyticsError.js';

export class AnalyticsCollector implements IAnalyticsCollector {
  constructor(
    private readonly store: IAnalyticsStore,
    private readonly metricRegistry: IMetricRegistry,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async ingestRecord(record: AnalyticsRecord): Promise<void> {
    if (!this.metricRegistry.hasMetric(record.metricId)) {
      throw new MetricNotFoundError(record.metricId);
    }

    await this.store.saveRecord(record);

    if (this.eventBus) {
      this.eventBus.publish(ANALYTICS_EVENT_NAMES.RECORD_INGESTED, {
        recordId: record.recordId,
        metricId: record.metricId,
        scope: record.scope,
        timestamp: record.timestamp,
      });
    }
  }

  public async ingestRecords(records: readonly AnalyticsRecord[]): Promise<void> {
    for (const r of records) {
      await this.ingestRecord(r);
    }
  }
}
