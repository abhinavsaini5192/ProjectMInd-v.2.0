import type {
  ILearningStore,
  SignalQuery,
  CandidateQuery,
  DeployedQuery,
} from '../interfaces/ILearningStore.js';
import type { LearningSignal } from '../models/LearningSignal.js';
import type { LearningCandidate } from '../models/LearningCandidate.js';
import type { LearningEvaluation } from '../models/LearningEvaluation.js';
import type { DeployedLearning } from '../models/DeployedLearning.js';
import type { LearningRollback } from '../models/LearningRollback.js';
import type { LearningConflict } from '../models/LearningConflict.js';
import type { LearningImpact } from '../models/LearningImpact.js';

export class InMemoryLearningStore implements ILearningStore {
  private readonly signals = new Map<string, LearningSignal>();
  private readonly candidates = new Map<string, LearningCandidate>();
  private readonly evaluations = new Map<string, LearningEvaluation>();
  private readonly deployed = new Map<string, DeployedLearning>();
  private readonly rollbacks: LearningRollback[] = [];
  private readonly conflicts: LearningConflict[] = [];
  private readonly impacts: LearningImpact[] = [];

  // Signals
  public async saveSignal(signal: LearningSignal): Promise<void> {
    this.signals.set(signal.id, signal);
  }

  public async getSignals(query: SignalQuery): Promise<LearningSignal[]> {
    let result = Array.from(this.signals.values()).filter((s) => s.workspaceId === query.workspaceId);
    if (query.projectId) {
      result = result.filter((s) => s.projectId === query.projectId);
    }
    if (query.targetType) {
      result = result.filter((s) => s.target.targetType === query.targetType);
    }
    if (query.targetId) {
      result = result.filter((s) => s.target.targetId === query.targetId);
    }
    if (query.type) {
      result = result.filter((s) => s.type === query.type);
    }
    result.sort((a, b) => b.createdAt - a.createdAt);
    if (query.limit) {
      result = result.slice(0, query.limit);
    }
    return result;
  }

  // Candidates
  public async saveCandidate(candidate: LearningCandidate): Promise<void> {
    this.candidates.set(candidate.id, candidate);
  }

  public async getCandidate(id: string): Promise<LearningCandidate | null> {
    return this.candidates.get(id) ?? null;
  }

  public async queryCandidates(query: CandidateQuery): Promise<LearningCandidate[]> {
    let result = Array.from(this.candidates.values()).filter((c) => c.workspaceId === query.workspaceId);
    if (query.projectId) {
      result = result.filter((c) => c.projectId === query.projectId);
    }
    if (query.targetSystem) {
      result = result.filter((c) => c.target.system === query.targetSystem);
    }
    if (query.status && query.status.length > 0) {
      result = result.filter((c) => query.status!.includes(c.evaluationStatus));
    }
    if (query.scopeLevel) {
      result = result.filter((c) => c.scope.level === query.scopeLevel);
    }
    result.sort((a, b) => b.updatedAt - a.updatedAt);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return result.slice(offset, offset + limit);
  }

  public async updateCandidate(candidate: LearningCandidate): Promise<void> {
    this.candidates.set(candidate.id, candidate);
  }

  // Evaluations
  public async saveEvaluation(evaluation: LearningEvaluation): Promise<void> {
    this.evaluations.set(evaluation.candidateId, evaluation);
  }

  public async getEvaluation(candidateId: string): Promise<LearningEvaluation | null> {
    return this.evaluations.get(candidateId) ?? null;
  }

  // Deployed
  public async saveDeployed(deployed: DeployedLearning): Promise<void> {
    this.deployed.set(deployed.id, deployed);
  }

  public async getDeployed(id: string): Promise<DeployedLearning | null> {
    return this.deployed.get(id) ?? null;
  }

  public async queryDeployed(query: DeployedQuery): Promise<DeployedLearning[]> {
    let result = Array.from(this.deployed.values()).filter((d) => d.scope.workspaceId === query.workspaceId);
    if (query.projectId) {
      result = result.filter((d) => d.scope.projectId === query.projectId);
    }
    if (query.targetSystem) {
      result = result.filter((d) => d.target.system === query.targetSystem);
    }
    if (query.status && query.status.length > 0) {
      result = result.filter((d) => query.status!.includes(d.status));
    }
    if (query.scopeLevel) {
      result = result.filter((d) => d.scope.level === query.scopeLevel);
    }
    result.sort((a, b) => b.deployedAt - a.deployedAt);
    if (query.limit) {
      result = result.slice(0, query.limit);
    }
    return result;
  }

  public async updateDeployed(deployed: DeployedLearning): Promise<void> {
    this.deployed.set(deployed.id, deployed);
  }

  // Rollbacks
  public async saveRollback(rollback: LearningRollback): Promise<void> {
    this.rollbacks.push(rollback);
  }

  public async getRollbacks(deployedLearningId?: string): Promise<LearningRollback[]> {
    if (deployedLearningId) {
      return this.rollbacks.filter((r) => r.deployedLearningId === deployedLearningId);
    }
    return [...this.rollbacks];
  }

  // Conflicts
  public async saveConflict(conflict: LearningConflict): Promise<void> {
    this.conflicts.push(conflict);
  }

  public async getConflicts(workspaceId: string, projectId?: string): Promise<LearningConflict[]> {
    return this.conflicts.filter(() => true);
  }

  // Impacts
  public async saveImpact(impact: LearningImpact): Promise<void> {
    this.impacts.push(impact);
  }

  public async getImpacts(deployedLearningId?: string): Promise<LearningImpact[]> {
    if (deployedLearningId) {
      return this.impacts.filter((i) => i.deployedLearningId === deployedLearningId);
    }
    return [...this.impacts];
  }
}
