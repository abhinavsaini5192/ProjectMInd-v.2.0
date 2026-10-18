import type { Feedback } from '../models/Feedback.js';
import type { LearningSignal } from '../models/LearningSignal.js';
import type { LearningCandidate } from '../models/LearningCandidate.js';
import type { LearningEvaluation } from '../models/LearningEvaluation.js';
import type { DeployedLearning } from '../models/DeployedLearning.js';
import type { LearningRollback } from '../models/LearningRollback.js';
import type { LearningConflict } from '../models/LearningConflict.js';

export const LearningEventNames = {
  FEEDBACK_RECEIVED: 'learning.feedback.received',
  FEEDBACK_NORMALIZED: 'learning.feedback.normalized',
  FEEDBACK_REJECTED: 'learning.feedback.rejected',
  SIGNAL_EXTRACTED: 'learning.signal.extracted',
  CANDIDATE_GENERATED: 'learning.candidate.generated',
  CANDIDATE_EVALUATING: 'learning.candidate.evaluating',
  CANDIDATE_EVALUATED: 'learning.candidate.evaluated',
  CANDIDATE_APPROVED: 'learning.candidate.approved',
  CANDIDATE_REJECTED: 'learning.candidate.rejected',
  DEPLOYED: 'learning.deployed',
  DISABLED: 'learning.disabled',
  ROLLED_BACK: 'learning.rolled_back',
  CONFLICT_DETECTED: 'learning.conflict.detected',
  POLICY_VIOLATED: 'learning.policy.violated',
} as const;

export type LearningEventName = (typeof LearningEventNames)[keyof typeof LearningEventNames];

export interface FeedbackReceivedPayload {
  readonly feedback: Feedback;
}

export interface FeedbackRejectedPayload {
  readonly rawInput: Record<string, any>;
  readonly reason: string;
}

export interface SignalExtractedPayload {
  readonly signal: LearningSignal;
}

export interface CandidateGeneratedPayload {
  readonly candidate: LearningCandidate;
}

export interface CandidateEvaluatedPayload {
  readonly candidateId: string;
  readonly evaluation: LearningEvaluation;
}

export interface CandidateDeployedPayload {
  readonly deployedLearning: DeployedLearning;
}

export interface LearningRolledBackPayload {
  readonly rollback: LearningRollback;
  readonly previousState: Record<string, any>;
}

export interface ConflictDetectedPayload {
  readonly conflict: LearningConflict;
}
