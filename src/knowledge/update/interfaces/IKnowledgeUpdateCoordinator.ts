import type { KnowledgeUpdate, CreateKnowledgeUpdateParams } from '../models/KnowledgeUpdate.js';
import type { KnowledgeUpdatePlan } from '../models/KnowledgeUpdatePlan.js';
import type { KnowledgeUpdateResult } from '../models/KnowledgeUpdateResult.js';
import type { KnowledgeUpdateRun } from '../models/KnowledgeUpdateRun.js';
import type { KnowledgeUpdateStatus } from '../models/KnowledgeUpdateStatus.js';
import type { KnowledgeVersion } from '../models/KnowledgeVersion.js';
import type { KnowledgeInvalidation } from '../models/KnowledgeInvalidation.js';
import type { KnowledgeRefreshDecision } from '../models/KnowledgeRefreshDecision.js';
import type { ExecutionObservation } from '../../../agent/observation/models/ExecutionObservation.js';
import type { VerificationRecord } from '../../../verification/models/VerificationRecord.js';

export interface IKnowledgeUpdateCoordinator {
  processKnowledgeUpdate(params: CreateKnowledgeUpdateParams): Promise<KnowledgeUpdateResult>;
  processKnowledgeUpdates(paramsList: CreateKnowledgeUpdateParams[]): Promise<KnowledgeUpdateRun>;

  applyExecutionObservations(observations: readonly ExecutionObservation[]): Promise<KnowledgeUpdateRun>;
  applyVerificationEvidence(evidence: readonly VerificationRecord[]): Promise<KnowledgeUpdateRun>;

  planKnowledgeUpdate(params: CreateKnowledgeUpdateParams): Promise<KnowledgeUpdatePlan>;

  getKnowledgeUpdate(updateId: string): Promise<KnowledgeUpdate | null>;
  getKnowledgeUpdateRun(runId: string): Promise<KnowledgeUpdateRun | null>;
  getKnowledgeUpdateStatus(updateId: string): Promise<KnowledgeUpdateStatus | null>;
  getKnowledgeVersion(repositoryId: string): Promise<KnowledgeVersion | null>;
  getPendingKnowledgeUpdates(repositoryId: string): Promise<KnowledgeUpdate[]>;

  retryKnowledgeUpdate(updateId: string): Promise<KnowledgeUpdateResult>;

  getKnowledgeInvalidations(updateId: string): Promise<KnowledgeInvalidation[]>;
  getRefreshDecisions(updateId: string): Promise<KnowledgeRefreshDecision[]>;
  explainKnowledgeUpdate(updateId: string): Promise<string>;
}
