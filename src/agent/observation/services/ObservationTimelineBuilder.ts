import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type {
  ObservationTimeline,
  ObservationTimelineEntry,
  ObservationCausality,
} from '../models/ObservationTimeline.js';
import type { IObservationStore } from '../interfaces/IObservationStore.js';

export class ObservationTimelineBuilder {
  constructor(private readonly store: IObservationStore) {}

  public async buildTimeline(taskId: string): Promise<ObservationTimeline> {
    const rawEntries = await this.store.getTimelineEntries(taskId);
    if (rawEntries.length > 0) {
      return {
        taskId,
        entries: rawEntries,
        totalEntries: rawEntries.length,
        totalObservations: rawEntries.length,
        firstObservedAt: rawEntries[0]?.timestamp,
        lastObservedAt: rawEntries[rawEntries.length - 1]?.timestamp,
      };
    }

    // Fallback: build from stored observations
    const observations = await this.store.listObservations({
      workspaceId: '',
      repositoryId: '',
      taskId,
      limit: 1000,
    });

    const entries: ObservationTimelineEntry[] = observations.map((obs) => {
      const payload = obs.payload as Record<string, unknown>;
      const summary =
        typeof payload['summary'] === 'string'
          ? payload['summary']
          : typeof payload['description'] === 'string'
            ? payload['description']
            : `${obs.type} reported by ${obs.source}`;

      const affectedResources: string[] = [];
      if (obs.affectedResources) {
        for (const r of obs.affectedResources) affectedResources.push(r);
      }
      if (typeof payload['path'] === 'string') affectedResources.push(payload['path']);
      if (Array.isArray(payload['modifiedFiles'])) {
        affectedResources.push(...payload['modifiedFiles'].filter((f) => typeof f === 'string'));
      }

      let causality: ObservationCausality = 'SEQUENTIAL';
      if (obs.correlationId || obs.parentObservationId) causality = 'EXPLICIT';
      else if (obs.type.startsWith('TEST_') || obs.type.startsWith('BUILD_')) causality = 'CORRELATED';

      return {
        entryId: `entry_${obs.observationId}`,
        observationId: obs.observationId,
        timestamp: obs.timestamp,
        type: obs.type,
        summary,
        provenance: obs.provenance,
        causality,
        affectedResources: Array.from(new Set(affectedResources)),
        operationId: obs.operationId,
        parentObservationId: obs.parentObservationId,
      };
    });

    entries.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

    return {
      taskId,
      entries,
      totalEntries: entries.length,
      totalObservations: entries.length,
      firstObservedAt: entries[0]?.timestamp,
      lastObservedAt: entries[entries.length - 1]?.timestamp,
    };
  }
}
