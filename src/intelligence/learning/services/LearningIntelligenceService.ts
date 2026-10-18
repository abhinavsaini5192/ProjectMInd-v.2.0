import type {
  ILearningIntelligenceService,
  LearningExplanation,
} from '../interfaces/ILearningIntelligenceService.js';
import type { Feedback, RawFeedbackInput } from '../models/Feedback.js';
import type { FeedbackQuery, IFeedbackStore } from '../interfaces/IFeedbackStore.js';
import type { SignalQuery, CandidateQuery, DeployedQuery, ILearningStore } from '../interfaces/ILearningStore.js';
import type { IFeedbackCollector } from '../interfaces/IFeedbackCollector.js';
import type { ILearningSignalExtractor } from '../interfaces/ILearningSignalExtractor.js';
import type { ILearningCandidateGenerator } from '../interfaces/ILearningCandidateGenerator.js';
import type { ILearningEvaluator, EvaluationOptions } from '../interfaces/ILearningEvaluator.js';
import type { ILearningPolicyEngine } from '../interfaces/ILearningPolicyEngine.js';
import type { ILearningDeploymentManager } from '../interfaces/ILearningDeploymentManager.js';
import type { ILearningRollbackManager } from '../interfaces/ILearningRollbackManager.js';
import type { LearningSignal } from '../models/LearningSignal.js';
import type { LearningCandidate } from '../models/LearningCandidate.js';
import type { LearningEvaluation } from '../models/LearningEvaluation.js';
import type { DeployedLearning } from '../models/DeployedLearning.js';
import type { LearningRollback } from '../models/LearningRollback.js';
import type { LearningConflict } from '../models/LearningConflict.js';
import { CandidateNotFoundError, LearningError } from '../errors/LearningError.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { LearningEventNames } from '../events/LearningEvents.js';

export class LearningIntelligenceService implements ILearningIntelligenceService {
  constructor(
    private readonly feedbackStore: IFeedbackStore,
    private readonly learningStore: ILearningStore,
    private readonly collector: IFeedbackCollector,
    private readonly signalExtractor: ILearningSignalExtractor,
    private readonly candidateGenerator: ILearningCandidateGenerator,
    private readonly evaluator: ILearningEvaluator,
    private readonly policyEngine: ILearningPolicyEngine,
    private readonly deploymentManager: ILearningDeploymentManager,
    private readonly rollbackManager: ILearningRollbackManager,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async submitFeedback(input: RawFeedbackInput): Promise<Feedback> {
    return this.collector.recordFeedback(input);
  }

  public async getFeedback(id: string): Promise<Feedback | null> {
    return this.feedbackStore.getFeedback(id);
  }

  public async queryFeedback(query: FeedbackQuery): Promise<Feedback[]> {
    return this.feedbackStore.queryFeedback(query);
  }

  public async generateSignals(workspaceId: string, projectId: string): Promise<LearningSignal[]> {
    const feedbackItems = await this.feedbackStore.queryFeedback({
      workspaceId,
      projectId,
      limit: 1000,
    });
    return this.signalExtractor.extractSignals(feedbackItems);
  }

  public async getSignals(query: SignalQuery): Promise<LearningSignal[]> {
    return this.learningStore.getSignals(query);
  }

  public async generateCandidates(workspaceId: string, projectId: string): Promise<LearningCandidate[]> {
    const signals = await this.learningStore.getSignals({
      workspaceId,
      projectId,
      limit: 500,
    });
    const candidates = await this.candidateGenerator.generateCandidates(signals);

    // Auto-evaluate generated candidates
    for (const cand of candidates) {
      try {
        const evalResult = await this.evaluator.evaluateCandidate(cand);
        const status: 'ACCEPTED' | 'REJECTED' = evalResult.isAccepted ? 'ACCEPTED' : 'REJECTED';
        const updated = {
          ...cand,
          evaluationStatus: status,
          updatedAt: Date.now(),
        };
        await this.learningStore.updateCandidate(updated);

        // Check if policy permits automatic deployment
        if (this.policyEngine.canAutoDeploy(updated, evalResult)) {
          await this.deploymentManager.deployCandidate(updated.id, 'policy-engine:auto-deploy');
        }
      } catch {
        // Continue evaluating other candidates
      }
    }

    return candidates;
  }

  public async getCandidates(query: CandidateQuery): Promise<LearningCandidate[]> {
    return this.learningStore.queryCandidates(query);
  }

  public async getCandidate(id: string): Promise<LearningCandidate | null> {
    return this.learningStore.getCandidate(id);
  }

  public async evaluateCandidate(candidateId: string, options?: EvaluationOptions): Promise<LearningEvaluation> {
    const candidate = await this.learningStore.getCandidate(candidateId);
    if (!candidate) {
      throw new CandidateNotFoundError(candidateId);
    }

    const evaluation = await this.evaluator.evaluateCandidate(candidate, options);
    const newStatus = evaluation.isAccepted ? 'ACCEPTED' : 'REJECTED';
    await this.learningStore.updateCandidate({
      ...candidate,
      evaluationStatus: newStatus,
      updatedAt: Date.now(),
    });

    return evaluation;
  }

  public async approveCandidate(candidateId: string, approver: string): Promise<LearningCandidate> {
    const candidate = await this.learningStore.getCandidate(candidateId);
    if (!candidate) {
      throw new CandidateNotFoundError(candidateId);
    }

    const updated: LearningCandidate = {
      ...candidate,
      authority: 'APPROVED',
      evaluationStatus: 'ACCEPTED',
      reasoning: [...candidate.reasoning, `Explicitly approved by ${approver} at ${new Date().toISOString()}`],
      updatedAt: Date.now(),
    };

    await this.learningStore.updateCandidate(updated);

    if (this.eventBus) {
      this.eventBus.publish(LearningEventNames.CANDIDATE_APPROVED, { candidate: updated });
    }

    return updated;
  }

  public async rejectCandidate(candidateId: string, reason: string, actor: string): Promise<LearningCandidate> {
    const candidate = await this.learningStore.getCandidate(candidateId);
    if (!candidate) {
      throw new CandidateNotFoundError(candidateId);
    }

    const updated: LearningCandidate = {
      ...candidate,
      evaluationStatus: 'REJECTED',
      deploymentMode: 'DISABLED',
      reasoning: [...candidate.reasoning, `Rejected by ${actor}: ${reason}`],
      updatedAt: Date.now(),
    };

    await this.learningStore.updateCandidate(updated);

    if (this.eventBus) {
      this.eventBus.publish(LearningEventNames.CANDIDATE_REJECTED, { candidate: updated });
    }

    return updated;
  }

  public async deployCandidate(candidateId: string, actor: string): Promise<DeployedLearning> {
    return this.deploymentManager.deployCandidate(candidateId, actor);
  }

  public async disableLearning(deployedLearningId: string, actor: string): Promise<DeployedLearning> {
    return this.deploymentManager.disableLearning(deployedLearningId, actor);
  }

  public async rollbackLearning(
    deployedLearningId: string,
    reason: string,
    actor: string
  ): Promise<LearningRollback> {
    return this.rollbackManager.rollbackLearning(deployedLearningId, reason, actor);
  }

  public async getDeployedLearnings(query: DeployedQuery): Promise<DeployedLearning[]> {
    return this.learningStore.queryDeployed(query);
  }

  public async explainLearning(id: string): Promise<LearningExplanation> {
    // Check candidate first
    const candidate = await this.learningStore.getCandidate(id);
    if (candidate) {
      const evaluation = await this.learningStore.getEvaluation(id);
      return {
        id: candidate.id,
        type: 'CANDIDATE',
        targetSystem: candidate.target.system,
        targetId: candidate.target.targetId,
        scope: `${candidate.scope.level}:${candidate.scope.value}`,
        confidence: candidate.confidence,
        authority: candidate.authority,
        status: candidate.evaluationStatus,
        primaryReasons: candidate.reasoning,
        supportingEvidenceCount: candidate.evidence.length,
        conflictingEvidence: evaluation?.conflictsDetected ?? [],
        potentialRisks: evaluation?.risksIdentified ?? [],
        reversibility: candidate.reversibility,
      };
    }

    // Check deployed learning
    const deployed = await this.learningStore.getDeployed(id);
    if (deployed) {
      const evaluation = await this.learningStore.getEvaluation(deployed.candidateId);
      return {
        id: deployed.id,
        type: 'DEPLOYED_LEARNING',
        targetSystem: deployed.target.system,
        targetId: deployed.target.targetId,
        scope: `${deployed.scope.level}:${deployed.scope.value}`,
        confidence: 1.0,
        authority: 'DEPLOYED',
        status: deployed.status,
        primaryReasons: [
          `Deployed by ${deployed.deployedBy} at ${new Date(deployed.deployedAt).toISOString()}`,
          `Version ${deployed.version}.`,
          `Expected effect: ${deployed.metadata?.['expectedEffect'] ?? 'Optimized behavior'}`,
        ],
        supportingEvidenceCount: 1,
        conflictingEvidence: evaluation?.conflictsDetected ?? [],
        potentialRisks: evaluation?.risksIdentified ?? [],
        reversibility: 'FULL',
      };
    }

    throw new LearningError(`Learning artifact "${id}" not found for explanation.`);
  }

  public async getConflicts(workspaceId: string, projectId?: string): Promise<LearningConflict[]> {
    return this.learningStore.getConflicts(workspaceId, projectId);
  }
}
