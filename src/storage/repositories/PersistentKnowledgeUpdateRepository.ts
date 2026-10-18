import type { IKnowledgeUpdateRepository } from '../../knowledge/update/interfaces/IKnowledgeUpdateRepository.js';
import type { KnowledgeUpdate } from '../../knowledge/update/models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../../knowledge/update/models/KnowledgeUpdatePlan.js';
import type { KnowledgeUpdateRun } from '../../knowledge/update/models/KnowledgeUpdateRun.js';
import type { KnowledgeVersion } from '../../knowledge/update/models/KnowledgeVersion.js';
import type { KnowledgeInvalidation } from '../../knowledge/update/models/KnowledgeInvalidation.js';
import type { KnowledgeRefreshDecision } from '../../knowledge/update/models/KnowledgeRefreshDecision.js';
import type { KnowledgeUpdateConflict } from '../../knowledge/update/models/KnowledgeUpdateConflict.js';
import type { ILogger } from '../../workspace/interfaces/ILogger.js';

export class PersistentKnowledgeUpdateRepository implements IKnowledgeUpdateRepository {
  private readonly updates = new Map<string, KnowledgeUpdate>();
  private readonly updateByIdempotency = new Map<string, string>();
  private readonly plans = new Map<string, KnowledgeUpdatePlan>();
  private readonly runs = new Map<string, KnowledgeUpdateRun>();
  private readonly versions = new Map<string, KnowledgeVersion[]>(); // repositoryId -> versions
  private readonly invalidations = new Map<string, KnowledgeInvalidation[]>(); // updateId -> invalidations
  private readonly refreshDecisions = new Map<string, KnowledgeRefreshDecision[]>(); // updateId -> decisions
  private readonly conflicts = new Map<string, KnowledgeUpdateConflict[]>(); // updateId -> conflicts

  constructor(private readonly logger?: ILogger | undefined) {}

  public async saveUpdate(update: KnowledgeUpdate): Promise<void> {
    this.updates.set(update.updateId, update);
    if (update.idempotencyKey) {
      this.updateByIdempotency.set(update.idempotencyKey, update.updateId);
    }
    this.logger?.debug?.({
      component: 'PersistentKnowledgeUpdateRepository',
      operation: 'saveUpdate',
      message: `Saved update ${update.updateId} for repo ${update.repositoryId}`,
    });
  }

  public async getUpdate(updateId: string): Promise<KnowledgeUpdate | null> {
    return this.updates.get(updateId) ?? null;
  }

  public async getUpdateByIdempotencyKey(key: string): Promise<KnowledgeUpdate | null> {
    const updateId = this.updateByIdempotency.get(key);
    if (!updateId) return null;
    return this.getUpdate(updateId);
  }

  public async listUpdates(repositoryId: string): Promise<KnowledgeUpdate[]> {
    return Array.from(this.updates.values()).filter(
      (u) => u.repositoryId === repositoryId
    );
  }

  public async getPendingUpdates(repositoryId: string): Promise<KnowledgeUpdate[]> {
    return Array.from(this.updates.values()).filter(
      (u) =>
        u.repositoryId === repositoryId &&
        (u.status === 'RECEIVED' || u.status === 'VALIDATED' || u.status === 'PLANNED' || u.status === 'RETRY_PENDING')
    );
  }

  public async savePlan(plan: KnowledgeUpdatePlan): Promise<void> {
    this.plans.set(plan.updateId, plan);
  }

  public async getPlan(updateId: string): Promise<KnowledgeUpdatePlan | null> {
    return this.plans.get(updateId) ?? null;
  }

  public async saveRun(run: KnowledgeUpdateRun): Promise<void> {
    this.runs.set(run.runId, run);
  }

  public async getRun(runId: string): Promise<KnowledgeUpdateRun | null> {
    return this.runs.get(runId) ?? null;
  }

  public async saveVersion(version: KnowledgeVersion): Promise<void> {
    const existing = this.versions.get(version.repositoryId) ?? [];
    existing.push(version);
    this.versions.set(version.repositoryId, existing);
  }

  public async getLatestVersion(repositoryId: string): Promise<KnowledgeVersion | null> {
    const list = this.versions.get(repositoryId) ?? [];
    if (list.length === 0) return null;
    return list[list.length - 1] ?? null;
  }

  public async saveInvalidation(invalidation: KnowledgeInvalidation): Promise<void> {
    const existing = this.invalidations.get(invalidation.updateId) ?? [];
    existing.push(invalidation);
    this.invalidations.set(invalidation.updateId, existing);
  }

  public async getInvalidationsByUpdate(updateId: string): Promise<KnowledgeInvalidation[]> {
    return this.invalidations.get(updateId) ?? [];
  }

  public async saveRefreshDecision(decision: KnowledgeRefreshDecision): Promise<void> {
    const existing = this.refreshDecisions.get(decision.updateId) ?? [];
    existing.push(decision);
    this.refreshDecisions.set(decision.updateId, existing);
  }

  public async getRefreshDecisionsByUpdate(updateId: string): Promise<KnowledgeRefreshDecision[]> {
    return this.refreshDecisions.get(updateId) ?? [];
  }

  public async saveConflict(conflict: KnowledgeUpdateConflict): Promise<void> {
    const existing = this.conflicts.get(conflict.updateId) ?? [];
    existing.push(conflict);
    this.conflicts.set(conflict.updateId, existing);
  }

  public async getConflictsByUpdate(updateId: string): Promise<KnowledgeUpdateConflict[]> {
    return this.conflicts.get(updateId) ?? [];
  }
}
