import type { IPersistentAuditStore } from '../../storage/repositories/PersistentAuditStore.js';
import type { IAnalyticsCollector } from '../interfaces/IAnalyticsCollector.js';
import type { AnalyticsRecord } from '../models/AnalyticsRecord.js';
import type { AnalyticsScopeRef } from '../models/AnalyticsScope.js';

export class AuditAnalyticsBridge {
  constructor(
    private readonly auditStore: IPersistentAuditStore,
    private readonly collector: IAnalyticsCollector
  ) {}

  public async syncAuditMetrics(
    scope: AnalyticsScopeRef,
    sinceTimestampMs: number = 0
  ): Promise<number> {
    const events = await this.auditStore.queryEvents();
    let synced = 0;

    for (const event of events) {
      const eventTime = new Date(event.timestamp).getTime();
      if (eventTime < sinceTimestampMs) {
        continue;
      }

      const eventWorkspaceId = event.workspaceId ?? (event as any).context?.workspaceId;
      const eventProjectId = (event as any).projectId ?? (event as any).context?.projectId;
      const eventScope: AnalyticsScopeRef = {
        scopeType: eventWorkspaceId ? 'WORKSPACE' : 'INSTANCE',
        workspaceId: eventWorkspaceId,
        projectId: eventProjectId,
      };

      // Match requested scope
      if (scope.scopeType !== 'INSTANCE' && scope.workspaceId && eventScope.workspaceId !== scope.workspaceId) {
        continue;
      }

      // Check event types
      if (event.eventType === 'SECURITY_VIOLATION' || (event.eventType as string) === 'SECURITY_EVENT') {
        const record: AnalyticsRecord = {
          recordId: `audit_${event.eventId}`,
          metricId: 'security.policy_violations.count',
          timestamp: eventTime,
          scope: eventScope,
          value: 1,
          sourceType: 'AUDIT_LOG',
          sourceReference: event.eventId,
          metadata: { action: event.action },
        };
        await this.collector.ingestRecord(record);
        synced++;
      } else if (event.eventType === 'PERMISSION_CHANGED' || (event.eventType as string) === 'ACCESS_CONTROL') {
        const record: AnalyticsRecord = {
          recordId: `audit_${event.eventId}`,
          metricId: 'security.permission_changes.count',
          timestamp: eventTime,
          scope: eventScope,
          value: 1,
          sourceType: 'AUDIT_LOG',
          sourceReference: event.eventId,
          metadata: { action: event.action },
        };
        await this.collector.ingestRecord(record);
        synced++;
      }
    }

    return synced;
  }
}
