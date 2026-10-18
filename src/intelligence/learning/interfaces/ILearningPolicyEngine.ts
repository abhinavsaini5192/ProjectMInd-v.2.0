import type { ScopeLevel } from '../models/LearningScope.js';
import type { LearningPolicy } from '../models/LearningPolicy.js';
import type { LearningCandidate } from '../models/LearningCandidate.js';
import type { LearningEvaluation } from '../models/LearningEvaluation.js';

export interface PolicyValidationResult {
  readonly passed: boolean;
  readonly violations: readonly string[];
}

export interface ILearningPolicyEngine {
  getPolicyForScope(scopeLevel: ScopeLevel): LearningPolicy;
  setPolicy(policy: LearningPolicy): void;
  validateCandidateAgainstPolicy(candidate: LearningCandidate, evaluation: LearningEvaluation): PolicyValidationResult;
  canAutoDeploy(candidate: LearningCandidate, evaluation: LearningEvaluation): boolean;
}
