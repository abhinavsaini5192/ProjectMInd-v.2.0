import type {
  IAnalyticsStore,
  RecordQueryFilter,
} from '../interfaces/IAnalyticsStore.js';
import type { AnalyticsRecord } from '../models/AnalyticsRecord.js';
import type { AnalyticsSnapshot } from '../models/AnalyticsSnapshot.js';
import type { AnalyticsReport } from '../models/AnalyticsReport.js';
import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';

export class InMemoryAnalyticsStore implements IAnalyticsStore {
  private readonly records: AnalyticsRecord[] = [];
  private readonly recordIds = new Set<string>();
  private readonly snapshots = new Map<string, AnalyticsSnapshot>();
  private readonly reports = new Map<string, AnalyticsReport>();

  public async saveRecord(record: AnalyticsRecord): Promise<void> {
    if (this.recordIds.has(record.recordId)) {
      // Idempotent duplicate protection
      return;
    }
    this.recordIds.add(record.recordId);
    this.records.push(Object.freeze({ ...record }));
  }

  public async saveRecords(records: readonly AnalyticsRecord[]): Promise<void> {
    for (const r of records) {
      await this.saveRecord(r);
    }
  }

  public async getRecords(filter: RecordQueryFilter): Promise<readonly AnalyticsRecord[]> {
    let matched = this.records.filter((r) => {
      // Scope match
      if (!this.matchesScope(r.scope, filter.scope)) {
        return false;
      }
      // Metric ID match
      if (filter.metricIds && filter.metricIds.length > 0) {
        if (!filter.metricIds.includes(r.metricId)) {
          return false;
        }
      }
      // Time range
      if (filter.startMs !== undefined && r.timestamp < filter.startMs) {
        return false;
      }
      if (filter.endMs !== undefined && r.timestamp > filter.endMs) {
        return false;
      }
      return true;
    });

    // Sort by timestamp asc
    matched.sort((a, b) => a.timestamp - b.timestamp);

    // Pagination
    if (filter.offset !== undefined && filter.offset > 0) {
      matched = matched.slice(filter.offset);
    }
    if (filter.limit !== undefined && filter.limit > 0) {
      matched = matched.slice(0, filter.limit);
    }

    return matched;
  }

  public async saveSnapshot(snapshot: AnalyticsSnapshot): Promise<void> {
    this.snapshots.set(snapshot.snapshotId, Object.freeze({ ...snapshot }));
  }

  public async getSnapshot(snapshotId: string): Promise<AnalyticsSnapshot | undefined> {
    return this.snapshots.get(snapshotId);
  }

  public async listSnapshots(
    scope: AnalyticsScopeRef,
    limit: number = 50
  ): Promise<readonly AnalyticsSnapshot[]> {
    const list = Array.from(this.snapshots.values()).filter((s) =>
      this.matchesScope(s.scope, scope)
    );
    list.sort((a, b) => b.timestamp - a.timestamp);
    return list.slice(0, limit);
  }

  public async saveReport(report: AnalyticsReport): Promise<void> {
    this.reports.set(report.reportId, Object.freeze({ ...report }));
  }

  public async getReport(reportId: string): Promise<AnalyticsReport | undefined> {
    return this.reports.get(reportId);
  }

  public async listReports(
    scope: AnalyticsScopeRef,
    limit: number = 50
  ): Promise<readonly AnalyticsReport[]> {
    const list = Array.from(this.reports.values()).filter((r) =>
      this.matchesScope(r.scope, scope)
    );
    list.sort((a, b) => b.generatedAt - a.generatedAt);
    return list.slice(0, limit);
  }

  public async pruneRecords(olderThanMs: number): Promise<number> {
    const initialCount = this.records.length;
    let pruned = 0;
    for (let i = this.records.length - 1; i >= 0; i--) {
      const rec = this.records[i]!;
      if (rec.timestamp < olderThanMs) {
        this.recordIds.delete(rec.recordId);
        this.records.splice(i, 1);
        pruned++;
      }
    }
    return pruned;
  }

  public async clear(): Promise<void> {
    this.records.length = 0;
    this.recordIds.clear();
    this.snapshots.clear();
    this.reports.clear();
  }

  private matchesScope(recordScope: AnalyticsScopeRef, filterScope: AnalyticsScopeRef): boolean {
    if (filterScope.scopeType === 'INSTANCE') {
      // Global instance query matches all records
      return true;
    }

    if (recordScope.scopeType === 'INSTANCE') {
      // Instance-level records belong to global scope only
      return false;
    }

    if (filterScope.workspaceId && recordScope.workspaceId && recordScope.workspaceId !== filterScope.workspaceId) {
      return false;
    }

    if (filterScope.projectId && recordScope.projectId && recordScope.projectId !== filterScope.projectId) {
      return false;
    }

    if (filterScope.repositoryId && recordScope.repositoryId && recordScope.repositoryId !== filterScope.repositoryId) {
      return false;
    }

    if (filterScope.entityId && recordScope.entityId && recordScope.entityId !== filterScope.entityId) {
      return false;
    }

    return true;
  }
}
