import type { FeatureHistoryEvent } from '../models/FeatureHistoryEvent.js';
import type { FeatureHistoryConflict } from '../models/FeatureHistoryConflict.js';
import { createHistoryConfidence } from '../models/FeatureHistoryConfidence.js';

export interface NormalizedEventsResult {
  events: FeatureHistoryEvent[];
  conflicts: FeatureHistoryConflict[];
}

export class FeatureHistoryNormalizer {
  /**
   * Deterministically orders events by:
   * 1. knowledgeVersion where available
   * 2. timestamp
   * 3. event priority
   * 4. stable event ID
   */
  public static sortEvents(events: FeatureHistoryEvent[]): FeatureHistoryEvent[] {
    const priorityMap: Record<string, number> = {
      FEATURE_CREATED: 10,
      FEATURE_DISCOVERED: 20,
      FEATURE_ACTIVATED: 30,
      FEATURE_EXPANDED: 40,
      FEATURE_MAPPING_ADDED: 50,
      FEATURE_MAPPING_CHANGED: 50,
      FEATURE_DEPENDENCY_ADDED: 60,
      FEATURE_DEPENDENCY_CHANGED: 60,
      FEATURE_BEHAVIOR_ADDED: 70,
      FEATURE_BEHAVIOR_CHANGED: 70,
      FEATURE_HEALTH_CHANGED: 80,
      FEATURE_RISK_CHANGED: 80,
      FEATURE_CRITICALITY_CHANGED: 80,
      FEATURE_ARCHITECTURE_CHANGED: 90,
      FEATURE_DEPRECATED: 100,
      FEATURE_DELETED: 110,
      TECHNICAL_CHANGE: 120,
      UNKNOWN: 999,
    };

    return [...events].sort((a, b) => {
      // 1. Knowledge version compare
      if (a.knowledgeVersion && b.knowledgeVersion && a.knowledgeVersion !== b.knowledgeVersion) {
        const vComp = a.knowledgeVersion.localeCompare(b.knowledgeVersion, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
        if (vComp !== 0) return vComp;
      }

      // 2. Timestamp compare
      if (a.timestamp !== b.timestamp) {
        return a.timestamp - b.timestamp;
      }

      // 3. Priority compare
      const pA = priorityMap[a.eventType] ?? 500;
      const pB = priorityMap[b.eventType] ?? 500;
      if (pA !== pB) {
        return pA - pB;
      }

      // 4. Stable event ID
      return a.eventId.localeCompare(b.eventId);
    });
  }

  /**
   * Validates and normalizes raw events, detecting contradictions and conflicts.
   */
  public static normalize(featureId: string, rawEvents: FeatureHistoryEvent[]): NormalizedEventsResult {
    const sorted = this.sortEvents(rawEvents);
    const validEvents: FeatureHistoryEvent[] = [];
    const conflicts: FeatureHistoryConflict[] = [];

    // Check for conflicting statuses at the same version/timestamp
    const versionStatusMap = new Map<string, { event: FeatureHistoryEvent; status: string }>();

    for (const ev of sorted) {
      // Validate basic shape
      if (!ev.eventId || !ev.featureId) {
        continue;
      }

      // Security check: Ignore attempts by documentation/comments to inject instructions
      if (ev.metadata?.isDocInjection) {
        continue;
      }

      validEvents.push(ev);

      // Check conflict: e.g. one event says DEPRECATED, another says ACTIVE at the same version
      if (
        ev.eventType === 'FEATURE_STATUS_CHANGED' ||
        ev.eventType === 'FEATURE_DEPRECATED' ||
        ev.eventType === 'FEATURE_REACTIVATED' ||
        ev.eventType === 'FEATURE_CREATED'
      ) {
        const status =
          ev.eventType === 'FEATURE_DEPRECATED'
            ? 'DEPRECATED'
            : ev.eventType === 'FEATURE_REACTIVATED' || ev.eventType === 'FEATURE_CREATED'
              ? 'ACTIVE'
              : ev.afterState?.status || 'UNKNOWN';

        const key = ev.knowledgeVersion || String(ev.timestamp);
        const existing = versionStatusMap.get(key);

        if (existing) {
          if (
            (existing.status === 'DEPRECATED' && status === 'ACTIVE') ||
            (existing.status === 'ACTIVE' && status === 'DEPRECATED')
          ) {
            conflicts.push({
              conflictId: `conflict_${featureId}_${key}_${Date.now()}`,
              featureId,
              conflictType: 'CONTRADICTORY_STATUS',
              competingEvents: [existing.event.eventId, ev.eventId],
              description: `Conflicting status at knowledge version ${key}: ${existing.status} vs ${status}`,
              severity: 'HIGH',
              confidence: createHistoryConfidence('HIGH', 0.9, ['Simultaneous contradictory status events']),
              resolutionStatus: 'UNRESOLVED',
              detectedAt: Date.now(),
            });
          }
        } else {
          versionStatusMap.set(key, { event: ev, status });
        }
      }
    }

    return { events: validEvents, conflicts };
  }
}
