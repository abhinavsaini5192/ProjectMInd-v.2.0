import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';
import type { KnowledgeUpdateRun } from '../models/KnowledgeUpdateRun.js';
import type { KnowledgeVersion } from '../models/KnowledgeVersion.js';
import type { KnowledgeInvalidation } from '../models/KnowledgeInvalidation.js';
import type { KnowledgeRefreshDecision } from '../models/KnowledgeRefreshDecision.js';
import type { KnowledgeUpdateConflict } from '../models/KnowledgeUpdateConflict.js';

export interface IKnowledgeUpdateRepository {
  saveUpdate(update: KnowledgeUpdate): Promise<void>;
  getUpdate(updateId: string): Promise<KnowledgeUpdate | null>;
  getUpdateByIdempotencyKey(key: string): Promise<KnowledgeUpdate | null>;
  listUpdates(repositoryId: string): Promise<KnowledgeUpdate[]>;
  getPendingUpdates(repositoryId: string): Promise<KnowledgeUpdate[]>;

  savePlan(plan: KnowledgeUpdatePlan): Promise<void>;
  getPlan(updateId: string): Promise<KnowledgeUpdatePlan | null>;

  saveRun(run: KnowledgeUpdateRun): Promise<void>;
  getRun(runId: string): Promise<KnowledgeUpdateRun | null>;

  saveVersion(version: KnowledgeVersion): Promise<void>;
  getLatestVersion(repositoryId: string): Promise<KnowledgeVersion | null>;

  saveInvalidation(invalidation: KnowledgeInvalidation): Promise<void>;
  getInvalidationsByUpdate(updateId: string): Promise<KnowledgeInvalidation[]>;

  saveRefreshDecision(decision: KnowledgeRefreshDecision): Promise<void>;
  getRefreshDecisionsByUpdate(updateId: string): Promise<KnowledgeRefreshDecision[]>;

  saveConflict(conflict: KnowledgeUpdateConflict): Promise<void>;
  getConflictsByUpdate(updateId: string): Promise<KnowledgeUpdateConflict[]>;
}
