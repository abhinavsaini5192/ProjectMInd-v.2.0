import type { LearningSignal } from '../models/LearningSignal.js';
import type { LearningCandidate, CandidateEvaluationStatus, CandidateTargetSystem } from '../models/LearningCandidate.js';
import type { LearningEvaluation } from '../models/LearningEvaluation.js';
import type { DeployedLearning, DeployedLearningStatus } from '../models/DeployedLearning.js';
import type { LearningRollback } from '../models/LearningRollback.js';
import type { LearningConflict } from '../models/LearningConflict.js';
import type { LearningImpact } from '../models/LearningImpact.js';
import type { ScopeLevel } from '../models/LearningScope.js';

export interface SignalQuery {
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly targetType?: string | undefined;
  readonly targetId?: string | undefined;
  readonly type?: string | undefined;
  readonly limit?: number | undefined;
}

export interface CandidateQuery {
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly targetSystem?: CandidateTargetSystem | undefined;
  readonly status?: CandidateEvaluationStatus[] | undefined;
  readonly scopeLevel?: ScopeLevel | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface DeployedQuery {
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly targetSystem?: CandidateTargetSystem | undefined;
  readonly status?: DeployedLearningStatus[] | undefined;
  readonly scopeLevel?: ScopeLevel | undefined;
  readonly limit?: number | undefined;
}

export interface ILearningStore {
  // Signals
  saveSignal(signal: LearningSignal): Promise<void>;
  getSignals(query: SignalQuery): Promise<LearningSignal[]>;

  // Candidates
  saveCandidate(candidate: LearningCandidate): Promise<void>;
  getCandidate(id: string): Promise<LearningCandidate | null>;
  queryCandidates(query: CandidateQuery): Promise<LearningCandidate[]>;
  updateCandidate(candidate: LearningCandidate): Promise<void>;

  // Evaluations
  saveEvaluation(evaluation: LearningEvaluation): Promise<void>;
  getEvaluation(candidateId: string): Promise<LearningEvaluation | null>;

  // Deployed Learning
  saveDeployed(deployed: DeployedLearning): Promise<void>;
  getDeployed(id: string): Promise<DeployedLearning | null>;
  queryDeployed(query: DeployedQuery): Promise<DeployedLearning[]>;
  updateDeployed(deployed: DeployedLearning): Promise<void>;

  // Rollbacks
  saveRollback(rollback: LearningRollback): Promise<void>;
  getRollbacks(deployedLearningId?: string): Promise<LearningRollback[]>;

  // Conflicts
  saveConflict(conflict: LearningConflict): Promise<void>;
  getConflicts(workspaceId: string, projectId?: string): Promise<LearningConflict[]>;

  // Impacts
  saveImpact(impact: LearningImpact): Promise<void>;
  getImpacts(deployedLearningId?: string): Promise<LearningImpact[]>;
}
