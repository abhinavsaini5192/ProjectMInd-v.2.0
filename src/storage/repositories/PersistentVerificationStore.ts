import type {
  IVerificationStore,
  VerificationQueryParams,
} from '../../verification/interfaces/IVerificationStore.js';
import type { VerificationRecord } from '../../verification/models/VerificationRecord.js';
import type { VerificationConflict } from '../../verification/models/VerificationConflict.js';
import type { VerificationTimelineEntry } from '../../verification/models/VerificationTimeline.js';
import type { VerificationType } from '../../verification/models/VerificationType.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export class PersistentVerificationStore implements IVerificationStore {
  private readonly records = new Map<string, VerificationRecord>();
  private readonly conflicts = new Map<string, VerificationConflict>();
  private readonly processedOps = new Map<string, string>(); // operationId -> verificationId
  private readonly timelines = new Map<string, VerificationTimelineEntry[]>(); // taskId -> timeline
  private readonly historicalRuns = new Map<string, VerificationRecord[]>(); // `${taskId}:${type}` -> history

  constructor(private readonly logger?: ILogger | undefined) {}

  public async saveVerification(record: VerificationRecord): Promise<void> {
    this.records.set(record.verificationId, record);

    // Maintain historical chronological record
    const historyKey = `${record.taskId}:${record.verificationType}`;
    const history = this.historicalRuns.get(historyKey) ?? [];
    history.push(record);
    this.historicalRuns.set(historyKey, history);

    this.logger?.debug?.({
      component: 'PersistentVerificationStore',
      operation: 'saveVerification',
      message: `Persisted verification '${record.verificationId}' (type: ${record.verificationType}, status: ${record.status})`,
    });
  }

  public async getVerification(verificationId: string): Promise<VerificationRecord | undefined> {
    return this.records.get(verificationId);
  }

  public async listVerifications(params: VerificationQueryParams): Promise<VerificationRecord[]> {
    let result = Array.from(this.records.values());

    if (params.workspaceId) {
      result = result.filter((r) => r.workspaceId === params.workspaceId);
    }
    if (params.repositoryId) {
      result = result.filter((r) => r.repositoryId === params.repositoryId);
    }
    if (params.taskId) {
      result = result.filter((r) => r.taskId === params.taskId);
    }
    if (params.agentSessionId) {
      result = result.filter((r) => r.agentSessionId === params.agentSessionId);
    }
    if (params.verificationType) {
      result = result.filter((r) => r.verificationType === params.verificationType);
    }
    if (params.status) {
      result = result.filter((r) => r.status === params.status);
    }
    if (params.source) {
      result = result.filter((r) => r.source === params.source);
    }
    if (params.resourceId) {
      result = result.filter((r) =>
        r.scope.targetFiles?.some((f) => f.includes(params.resourceId!)) ||
        r.scope.targetIds?.includes(params.resourceId!)
      );
    }
    if (params.featureId) {
      result = result.filter((r) =>
        r.scope.featureIds?.includes(params.featureId!)
      );
    }

    // Sort by receivedAt descending
    result.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    if (params.offset && params.offset > 0) {
      result = result.slice(params.offset);
    }
    if (params.limit && params.limit > 0) {
      result = result.slice(0, params.limit);
    }

    return result;
  }

  public async getLatestVerification(
    taskId: string,
    type?: VerificationType | undefined
  ): Promise<VerificationRecord | undefined> {
    const records = Array.from(this.records.values())
      .filter((r) => r.taskId === taskId && (!type || r.verificationType === type))
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    return records[0];
  }

  public async saveConflict(conflict: VerificationConflict): Promise<void> {
    this.conflicts.set(conflict.conflictId, conflict);
  }

  public async getConflict(conflictId: string): Promise<VerificationConflict | undefined> {
    return this.conflicts.get(conflictId);
  }

  public async listConflicts(taskId?: string | undefined): Promise<VerificationConflict[]> {
    let result = Array.from(this.conflicts.values());
    if (taskId) {
      result = result.filter((c) => c.taskId === taskId);
    }
    return result;
  }

  public async updateConflict(conflict: VerificationConflict): Promise<void> {
    this.conflicts.set(conflict.conflictId, conflict);
  }

  public async recordProcessedOperation(operationId: string, verificationId: string): Promise<void> {
    this.processedOps.set(operationId, verificationId);
  }

  public async hasProcessedOperation(operationId: string): Promise<boolean> {
    return this.processedOps.has(operationId);
  }

  public async getVerificationByOperationId(operationId: string): Promise<VerificationRecord | undefined> {
    const verId = this.processedOps.get(operationId);
    return verId ? this.records.get(verId) : undefined;
  }

  public async recordTimelineEntry(taskId: string, entry: VerificationTimelineEntry): Promise<void> {
    const entries = this.timelines.get(taskId) ?? [];
    entries.push(entry);
    this.timelines.set(taskId, entries);
  }

  public async getTimelineEntries(taskId: string): Promise<VerificationTimelineEntry[]> {
    return this.timelines.get(taskId) ?? [];
  }
}
