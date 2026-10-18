import type { IKnowledgeUpdateRepository } from '../interfaces/IKnowledgeUpdateRepository.js';
import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';
import type { KnowledgeUpdateRun } from '../models/KnowledgeUpdateRun.js';
import type { KnowledgeVersion } from '../models/KnowledgeVersion.js';
import type { KnowledgeInvalidation } from '../models/KnowledgeInvalidation.js';
import type { KnowledgeRefreshDecision } from '../models/KnowledgeRefreshDecision.js';
import type { KnowledgeUpdateConflict } from '../models/KnowledgeUpdateConflict.js';

export class InMemoryKnowledgeUpdateRepository implements IKnowledgeUpdateRepository {
  private readonly updates = new Map<string, KnowledgeUpdate>();
  private readonly idempotencyIndex = new Map<string, string>(); // key -> updateId
  private readonly plans = new Map<string, KnowledgeUpdatePlan>(); // updateId -> plan
  private readonly runs = new Map<string, KnowledgeUpdateRun>(); // runId -> run
  private readonly versions = new Map<string, KnowledgeVersion[]>(); // repositoryId -> versions
  private readonly invalidations = new Map<string, KnowledgeInvalidation[]>(); // updateId -> invalidations
  private readonly refreshDecisions = new Map<string, KnowledgeRefreshDecision[]>(); // updateId -> decisions
  private readonly conflicts = new Map<string, KnowledgeUpdateConflict[]>(); // updateId -> conflicts

  public async saveUpdate(update: KnowledgeUpdate): Promise<void> {
    this.updates.set(update.updateId, update);
    this.idempotencyIndex.set(update.idempotencyKey, update.updateId);
  }

  public async getUpdate(updateId: string): Promise<KnowledgeUpdate | null> {
    return this.updates.get(updateId) ?? null;
  }

  public async getUpdateByIdempotencyKey(key: string): Promise<KnowledgeUpdate | null> {
    const id = this.idempotencyIndex.get(key);
    if (!id) return null;
    return this.updates.get(id) ?? null;
  }

  public async listUpdates(repositoryId: string): Promise<KnowledgeUpdate[]> {
    return Array.from(this.updates.values()).filter((u) => u.repositoryId === repositoryId);
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
    const list = this.versions.get(version.repositoryId) || [];
    list.push(version);
    // Sort by versionNumber ascending
    list.sort((a, b) => a.versionNumber - b.versionNumber);
    this.versions.set(version.repositoryId, list);
  }

  public async getLatestVersion(repositoryId: string): Promise<KnowledgeVersion | null> {
    const list = this.versions.get(repositoryId);
    if (!list || list.length === 0) return null;
    return list[list.length - 1] ?? null;
  }

  public async saveInvalidation(invalidation: KnowledgeInvalidation): Promise<void> {
    const list = this.invalidations.get(invalidation.updateId) || [];
    list.push(invalidation);
    this.invalidations.set(invalidation.updateId, list);
  }

  public async getInvalidationsByUpdate(updateId: string): Promise<KnowledgeInvalidation[]> {
    return this.invalidations.get(updateId) ? [...this.invalidations.get(updateId)!] : [];
  }

  public async saveRefreshDecision(decision: KnowledgeRefreshDecision): Promise<void> {
    const list = this.refreshDecisions.get(decision.updateId) || [];
    list.push(decision);
    this.refreshDecisions.set(decision.updateId, list);
  }

  public async getRefreshDecisionsByUpdate(updateId: string): Promise<KnowledgeRefreshDecision[]> {
    return this.refreshDecisions.get(updateId) ? [...this.refreshDecisions.get(updateId)!] : [];
  }

  public async saveConflict(conflict: KnowledgeUpdateConflict): Promise<void> {
    const list = this.conflicts.get(conflict.updateId) || [];
    list.push(conflict);
    this.conflicts.set(conflict.updateId, list);
  }

  public async getConflictsByUpdate(updateId: string): Promise<KnowledgeUpdateConflict[]> {
    return this.conflicts.get(updateId) ? [...this.conflicts.get(updateId)!] : [];
  }

  public clear(): void {
    this.updates.clear();
    this.idempotencyIndex.clear();
    this.plans.clear();
    this.runs.clear();
    this.versions.clear();
    this.invalidations.clear();
    this.refreshDecisions.clear();
    this.conflicts.clear();
  }
}
