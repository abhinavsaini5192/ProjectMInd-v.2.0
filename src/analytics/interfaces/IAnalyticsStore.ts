import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';
import type { AnalyticsRecord } from '../models/AnalyticsRecord.js';
import type { AnalyticsSnapshot } from '../models/AnalyticsSnapshot.js';
import type { AnalyticsReport } from '../models/AnalyticsReport.js';

export interface RecordQueryFilter {
  readonly scope: AnalyticsScopeRef;
  readonly metricIds?: readonly string[] | undefined;
  readonly startMs?: number | undefined;
  readonly endMs?: number | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface IAnalyticsStore {
  saveRecord(record: AnalyticsRecord): Promise<void>;
  saveRecords(records: readonly AnalyticsRecord[]): Promise<void>;
  getRecords(filter: RecordQueryFilter): Promise<readonly AnalyticsRecord[]>;
  saveSnapshot(snapshot: AnalyticsSnapshot): Promise<void>;
  getSnapshot(snapshotId: string): Promise<AnalyticsSnapshot | undefined>;
  listSnapshots(scope: AnalyticsScopeRef, limit?: number): Promise<readonly AnalyticsSnapshot[]>;
  saveReport(report: AnalyticsReport): Promise<void>;
  getReport(reportId: string): Promise<AnalyticsReport | undefined>;
  listReports(scope: AnalyticsScopeRef, limit?: number): Promise<readonly AnalyticsReport[]>;
  pruneRecords(olderThanMs: number): Promise<number>;
  clear(): Promise<void>;
}

export const IAnalyticsStoreToken = Symbol('IAnalyticsStore');
