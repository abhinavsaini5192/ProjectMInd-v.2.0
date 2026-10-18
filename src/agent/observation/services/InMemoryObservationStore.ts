import type { ExecutionObservation } from '../models/ExecutionObservation.js';
import type { ObservationConflict } from '../models/ObservationConflict.js';
import type { ObservationTimelineEntry } from '../models/ObservationTimeline.js';
import type {
  IObservationStore,
  ObservationQueryFilter,
} from '../interfaces/IObservationStore.js';

export class InMemoryObservationStore implements IObservationStore {
  private readonly observations = new Map<string, ExecutionObservation>();
  private readonly operations = new Map<string, string>(); // operationId -> observationId
  private readonly conflicts = new Map<string, ObservationConflict>();
  private readonly taskConflicts = new Map<string, Set<string>>(); // taskId -> Set<conflictId>
  private readonly timelines = new Map<string, ObservationTimelineEntry[]>(); // taskId -> entries

  public async saveObservation(observation: ExecutionObservation): Promise<void> {
    this.observations.set(observation.observationId, observation);
    if (observation.operationId) {
      this.operations.set(observation.operationId, observation.observationId);
    }
  }

  public async getObservation(observationId: string): Promise<ExecutionObservation | undefined> {
    return this.observations.get(observationId);
  }

  public async getObservations(filter: Partial<ObservationQueryFilter>): Promise<readonly ExecutionObservation[]> {
    return this.listObservations(filter as ObservationQueryFilter);
  }

  public async listObservations(filter: ObservationQueryFilter): Promise<readonly ExecutionObservation[]> {
    let list = Array.from(this.observations.values());

    list = list.filter((obs) => {
      if (filter.workspaceId && obs.workspaceId !== filter.workspaceId) return false;
      if (filter.repositoryId && obs.repositoryId !== filter.repositoryId) return false;
      if (filter.taskId && obs.taskId !== filter.taskId) return false;
      if (filter.agentSessionId && obs.agentSessionId !== filter.agentSessionId) return false;
      if (filter.type && obs.type !== filter.type) return false;
      if (filter.source && obs.source !== filter.source) return false;

      if (filter.fromTimestamp && Date.parse(obs.timestamp) < Date.parse(filter.fromTimestamp)) {
        return false;
      }
      if (filter.toTimestamp && Date.parse(obs.timestamp) > Date.parse(filter.toTimestamp)) {
        return false;
      }

      const targetResource = filter.resourcePath ?? (filter as any).affectedResource;
      if (targetResource) {
        const payload = (obs.payload as Record<string, unknown>) ?? {};
        const inAffected = obs.affectedResources && obs.affectedResources.includes(targetResource);
        const inPayload =
          payload['path'] === targetResource ||
          payload['filePath'] === targetResource ||
          (Array.isArray(payload['modifiedFiles']) && payload['modifiedFiles'].includes(targetResource)) ||
          (Array.isArray(payload['affectedResources']) && payload['affectedResources'].includes(targetResource));
        if (!inAffected && !inPayload) return false;
      }

      return true;
    });

    // Sort chronologically ascending
    list.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    return list.slice(offset, offset + limit);
  }

  public async countObservations(filter: ObservationQueryFilter): Promise<number> {
    const list = await this.listObservations({ ...filter, offset: 0, limit: Number.MAX_SAFE_INTEGER });
    return list.length;
  }

  public async hasProcessedOperation(operationId: string): Promise<boolean> {
    return this.operations.has(operationId);
  }

  public async recordProcessedOperation(operationId: string, observationId: string): Promise<void> {
    this.operations.set(operationId, observationId);
  }

  public async getObservationByOperationId(operationId: string): Promise<ExecutionObservation | undefined> {
    const obsId = this.operations.get(operationId);
    if (!obsId) return undefined;
    return this.observations.get(obsId);
  }

  public async saveConflict(conflict: ObservationConflict): Promise<void> {
    this.conflicts.set(conflict.conflictId, conflict);
    if (!this.taskConflicts.has(conflict.taskId)) {
      this.taskConflicts.set(conflict.taskId, new Set());
    }
    this.taskConflicts.get(conflict.taskId)!.add(conflict.conflictId);
  }

  public async getConflict(conflictId: string): Promise<ObservationConflict | undefined> {
    return this.conflicts.get(conflictId);
  }

  public async listConflicts(taskId: string): Promise<readonly ObservationConflict[]> {
    const conflictIds = this.taskConflicts.get(taskId);
    if (!conflictIds) return [];
    return Array.from(conflictIds)
      .map((id) => this.conflicts.get(id))
      .filter((c): c is ObservationConflict => c !== undefined);
  }

  public async recordTimelineEntry(taskId: string, entry: ObservationTimelineEntry): Promise<void> {
    if (!this.timelines.has(taskId)) {
      this.timelines.set(taskId, []);
    }
    this.timelines.get(taskId)!.push(entry);
  }

  public async getTimelineEntries(taskId: string): Promise<readonly ObservationTimelineEntry[]> {
    const entries = this.timelines.get(taskId) ?? [];
    return [...entries].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  }

  public clear(): void {
    this.observations.clear();
    this.operations.clear();
    this.conflicts.clear();
    this.taskConflicts.clear();
    this.timelines.clear();
  }
}
