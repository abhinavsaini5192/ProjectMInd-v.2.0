import type { VerificationRecord } from '../models/VerificationRecord.js';
import type { VerificationConflict } from '../models/VerificationConflict.js';
import type { VerificationTimelineEntry } from '../models/VerificationTimeline.js';
import type { VerificationType } from '../models/VerificationType.js';
import type {
  IVerificationStore,
  VerificationQueryParams,
} from '../interfaces/IVerificationStore.js';

export class InMemoryVerificationStore implements IVerificationStore {
  private readonly records = new Map<string, VerificationRecord>();
  private readonly conflicts = new Map<string, VerificationConflict>();
  private readonly operations = new Map<string, string>(); // operationId -> verificationId
  private readonly timelineEntries = new Map<string, VerificationTimelineEntry[]>(); // taskId -> entries

  public async saveVerification(record: VerificationRecord): Promise<void> {
    this.records.set(record.verificationId, record);
    if (record.operationId) {
      this.operations.set(record.operationId, record.verificationId);
    }
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
    if (params.contextSessionId) {
      result = result.filter((r) => r.contextSessionId === params.contextSessionId);
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
        r.scope.targetFiles?.some((f) => f.includes(params.resourceId!))
      );
    }
    if (params.featureId) {
      result = result.filter((r) =>
        r.scope.featureIds?.includes(params.featureId!)
      );
    }

    // Sort by completedAt or receivedAt descending
    result.sort((a, b) => {
      const timeA = new Date(a.completedAt ?? a.receivedAt).getTime();
      const timeB = new Date(b.completedAt ?? b.receivedAt).getTime();
      return timeB - timeA;
    });


    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;

    return result.slice(offset, offset + limit);
  }

  public async getLatestVerification(
    taskId: string,
    type?: VerificationType | undefined
  ): Promise<VerificationRecord | undefined> {
    const list = await this.listVerifications({
      taskId,
      verificationType: type,
      limit: 1,
    });
    return list[0];
  }

  public async saveConflict(conflict: VerificationConflict): Promise<void> {
    this.conflicts.set(conflict.conflictId, conflict);
  }

  public async getConflict(conflictId: string): Promise<VerificationConflict | undefined> {
    return this.conflicts.get(conflictId);
  }

  public async listConflicts(taskId?: string | undefined): Promise<VerificationConflict[]> {
    const all = Array.from(this.conflicts.values());
    if (taskId) {
      return all.filter((c) => c.taskId === taskId);
    }
    return all;
  }

  public async updateConflict(conflict: VerificationConflict): Promise<void> {
    this.conflicts.set(conflict.conflictId, conflict);
  }

  public async recordProcessedOperation(
    operationId: string,
    verificationId: string
  ): Promise<void> {
    this.operations.set(operationId, verificationId);
  }

  public async hasProcessedOperation(operationId: string): Promise<boolean> {
    return this.operations.has(operationId);
  }

  public async getVerificationByOperationId(
    operationId: string
  ): Promise<VerificationRecord | undefined> {
    const verifId = this.operations.get(operationId);
    if (!verifId) return undefined;
    return this.records.get(verifId);
  }

  public async recordTimelineEntry(
    taskId: string,
    entry: VerificationTimelineEntry
  ): Promise<void> {
    const existing = this.timelineEntries.get(taskId) ?? [];
    existing.push(entry);
    this.timelineEntries.set(taskId, existing);
  }

  public async getTimelineEntries(taskId: string): Promise<VerificationTimelineEntry[]> {
    const entries = this.timelineEntries.get(taskId) ?? [];
    return [...entries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
}
