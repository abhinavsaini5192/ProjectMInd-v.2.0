import type { Feedback, RawFeedbackInput } from '../models/Feedback.js';
import type { FeedbackQuery } from './IFeedbackStore.js';
import type { SignalQuery, CandidateQuery, DeployedQuery } from './ILearningStore.js';
import type { LearningSignal } from '../models/LearningSignal.js';
import type { LearningCandidate } from '../models/LearningCandidate.js';
import type { LearningEvaluation } from '../models/LearningEvaluation.js';
import type { DeployedLearning } from '../models/DeployedLearning.js';
import type { LearningRollback } from '../models/LearningRollback.js';
import type { LearningConflict } from '../models/LearningConflict.js';
import type { EvaluationOptions } from './ILearningEvaluator.js';

export interface LearningExplanation {
  readonly id: string;
  readonly type: 'CANDIDATE' | 'DEPLOYED_LEARNING';
  readonly targetSystem: string;
  readonly targetId: string;
  readonly scope: string;
  readonly confidence: number;
  readonly authority: string;
  readonly status: string;
  readonly primaryReasons: readonly string[];
  readonly supportingEvidenceCount: number;
  readonly conflictingEvidence: readonly string[];
  readonly potentialRisks: readonly string[];
  readonly reversibility: string;
}

export interface ILearningIntelligenceService {
  submitFeedback(input: RawFeedbackInput): Promise<Feedback>;
  getFeedback(id: string): Promise<Feedback | null>;
  queryFeedback(query: FeedbackQuery): Promise<Feedback[]>;

  generateSignals(workspaceId: string, projectId: string): Promise<LearningSignal[]>;
  getSignals(query: SignalQuery): Promise<LearningSignal[]>;

  generateCandidates(workspaceId: string, projectId: string): Promise<LearningCandidate[]>;
  getCandidates(query: CandidateQuery): Promise<LearningCandidate[]>;
  getCandidate(id: string): Promise<LearningCandidate | null>;

  evaluateCandidate(candidateId: string, options?: EvaluationOptions): Promise<LearningEvaluation>;
  approveCandidate(candidateId: string, approver: string): Promise<LearningCandidate>;
  rejectCandidate(candidateId: string, reason: string, actor: string): Promise<LearningCandidate>;

  deployCandidate(candidateId: string, actor: string): Promise<DeployedLearning>;
  disableLearning(deployedLearningId: string, actor: string): Promise<DeployedLearning>;
  rollbackLearning(deployedLearningId: string, reason: string, actor: string): Promise<LearningRollback>;

  getDeployedLearnings(query: DeployedQuery): Promise<DeployedLearning[]>;
  explainLearning(id: string): Promise<LearningExplanation>;
  getConflicts(workspaceId: string, projectId?: string): Promise<LearningConflict[]>;
}
