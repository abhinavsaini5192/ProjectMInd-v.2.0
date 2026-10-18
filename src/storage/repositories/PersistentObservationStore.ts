import type {
  IObservationStore,
  ObservationQueryFilter,
} from '../../agent/observation/interfaces/IObservationStore.js';
import type { ExecutionObservation } from '../../agent/observation/models/ExecutionObservation.js';
import type { ObservationConflict } from '../../agent/observation/models/ObservationConflict.js';
import type { ObservationTimelineEntry } from '../../agent/observation/models/ObservationTimeline.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export class PersistentObservationStore implements IObservationStore {
  private readonly observations = new Map<string, ExecutionObservation>();
  private readonly processedOperations = new Map<string, string>(); // operationId -> observationId
  private readonly conflicts = new Map<string, ObservationConflict>();
  private readonly timelines = new Map<string, ObservationTimelineEntry[]>(); // taskId -> timeline

  constructor(private readonly logger?: ILogger | undefined) {}

  public async saveObservation(observation: ExecutionObservation): Promise<void> {
    this.observations.set(observation.observationId, observation);
    this.logger?.debug?.({
      component: 'PersistentObservationStore',
      operation: 'saveObservation',
      message: `Persisted observation '${observation.observationId}' (type: ${observation.type})`,
    });
  }

  public async getObservation(observationId: string): Promise<ExecutionObservation | undefined> {
    return this.observations.get(observationId);
  }

  public async listObservations(
    filter: ObservationQueryFilter
  ): Promise<readonly ExecutionObservation[]> {
    let result = Array.from(this.observations.values());

    result = result.filter(
      (o) => o.workspaceId === filter.workspaceId && o.repositoryId === filter.repositoryId
    );

    if (filter.taskId) {
      result = result.filter((o) => o.taskId === filter.taskId);
    }
    if (filter.agentSessionId) {
      result = result.filter((o) => o.agentSessionId === filter.agentSessionId);
    }
    if (filter.type) {
      result = result.filter((o) => o.type === filter.type);
    }
    if (filter.source) {
      result = result.filter((o) => o.source === filter.source);
    }
    if (filter.resourcePath) {
      result = result.filter(
        (o) =>
          o.affectedResources?.includes(filter.resourcePath!) ||
          (o.payload as any)?.path === filter.resourcePath
      );
    }
    if (filter.fromTimestamp) {
      const from = new Date(filter.fromTimestamp).getTime();
      result = result.filter((o) => new Date(o.timestamp).getTime() >= from);
    }
    if (filter.toTimestamp) {
      const to = new Date(filter.toTimestamp).getTime();
      result = result.filter((o) => new Date(o.timestamp).getTime() <= to);
    }

    result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filter.offset && filter.offset > 0) {
      result = result.slice(filter.offset);
    }
    if (filter.limit && filter.limit > 0) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  public async countObservations(filter: ObservationQueryFilter): Promise<number> {
    const list = await this.listObservations({ ...filter, limit: undefined, offset: undefined });
    return list.length;
  }

  public async hasProcessedOperation(operationId: string): Promise<boolean> {
    return this.processedOperations.has(operationId);
  }

  public async recordProcessedOperation(
    operationId: string,
    observationId: string
  ): Promise<void> {
    this.processedOperations.set(operationId, observationId);
  }

  public async getObservationByOperationId(
    operationId: string
  ): Promise<ExecutionObservation | undefined> {
    const obsId = this.processedOperations.get(operationId);
    return obsId ? this.observations.get(obsId) : undefined;
  }

  public async saveConflict(conflict: ObservationConflict): Promise<void> {
    this.conflicts.set(conflict.conflictId, conflict);
  }

  public async getConflict(conflictId: string): Promise<ObservationConflict | undefined> {
    return this.conflicts.get(conflictId);
  }

  public async listConflicts(taskId: string): Promise<readonly ObservationConflict[]> {
    return Array.from(this.conflicts.values()).filter((c) => c.taskId === taskId);
  }

  public async recordTimelineEntry(
    taskId: string,
    entry: ObservationTimelineEntry
  ): Promise<void> {
    const entries = this.timelines.get(taskId) ?? [];
    entries.push(entry);
    this.timelines.set(taskId, entries);
  }

  public async getTimelineEntries(taskId: string): Promise<readonly ObservationTimelineEntry[]> {
    return this.timelines.get(taskId) ?? [];
  }
}
