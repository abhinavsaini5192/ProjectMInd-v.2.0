export const VerificationTokens = {
  IVerificationStore: Symbol.for('IVerificationStore'),
  IVerificationSourceTrustRegistry: Symbol.for('IVerificationSourceTrustRegistry'),
  IVerificationValidator: Symbol.for('IVerificationValidator'),
  IVerificationNormalizer: Symbol.for('IVerificationNormalizer'),
  IVerificationCorrelator: Symbol.for('IVerificationCorrelator'),
  IVerificationConflictResolver: Symbol.for('IVerificationConflictResolver'),
  IVerificationFreshnessEvaluator: Symbol.for('IVerificationFreshnessEvaluator'),
  IVerificationProcessor: Symbol.for('IVerificationProcessor'),
  IVerificationQueryService: Symbol.for('IVerificationQueryService'),

  // Handlers
  ProjectMindGetVerificationHandler: Symbol.for('ProjectMindGetVerificationHandler'),
  ProjectMindGetVerificationSummaryHandler: Symbol.for('ProjectMindGetVerificationSummaryHandler'),
  ProjectMindGetVerificationTimelineHandler: Symbol.for('ProjectMindGetVerificationTimelineHandler'),
  ProjectMindGetCompletionEvidenceHandler: Symbol.for('ProjectMindGetCompletionEvidenceHandler'),
  ProjectMindGetVerificationConflictsHandler: Symbol.for('ProjectMindGetVerificationConflictsHandler'),
};
