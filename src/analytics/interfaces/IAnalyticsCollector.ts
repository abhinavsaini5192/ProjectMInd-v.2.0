import type { AnalyticsRecord } from '../models/AnalyticsRecord.js';

export interface IAnalyticsCollector {
  ingestRecord(record: AnalyticsRecord): Promise<void>;
  ingestRecords(records: readonly AnalyticsRecord[]): Promise<void>;
}

export const IAnalyticsCollectorToken = Symbol('IAnalyticsCollector');
