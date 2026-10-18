export class LearningError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'LEARNING_ERROR',
    public readonly details?: Record<string, any> | undefined
  ) {
    super(message);
    this.name = 'LearningError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FeedbackValidationError extends LearningError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'FEEDBACK_VALIDATION_ERROR', details);
    this.name = 'FeedbackValidationError';
  }
}

export class FeedbackPoisoningError extends LearningError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'FEEDBACK_POISONING_DETECTED', details);
    this.name = 'FeedbackPoisoningError';
  }
}

export class ScopeViolationError extends LearningError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'SCOPE_VIOLATION_ERROR', details);
    this.name = 'ScopeViolationError';
  }
}

export class PolicyViolationError extends LearningError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'POLICY_VIOLATION_ERROR', details);
    this.name = 'PolicyViolationError';
  }
}

export class CandidateNotFoundError extends LearningError {
  constructor(candidateId: string) {
    super(`Learning candidate "${candidateId}" was not found.`, 'CANDIDATE_NOT_FOUND', { candidateId });
    this.name = 'CandidateNotFoundError';
  }
}

export class CandidateEvaluationError extends LearningError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'CANDIDATE_EVALUATION_ERROR', details);
    this.name = 'CandidateEvaluationError';
  }
}

export class DeploymentError extends LearningError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'DEPLOYMENT_ERROR', details);
    this.name = 'DeploymentError';
  }
}

export class RollbackError extends LearningError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'ROLLBACK_ERROR', details);
    this.name = 'RollbackError';
  }
}
