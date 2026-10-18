export const ToolTokens = {
  IAgentToolRegistry: Symbol.for('IAgentToolRegistry'),
  IAgentToolPipeline: Symbol.for('IAgentToolPipeline'),
  ToolIdempotencyManager: Symbol.for('ToolIdempotencyManager'),

  // Canonical Tool Handlers
  ProjectMindGetContextHandler: Symbol.for('ProjectMindGetContextHandler'),
  ProjectMindGetFeatureHandler: Symbol.for('ProjectMindGetFeatureHandler'),
  ProjectMindGetFeatureContextHandler: Symbol.for('ProjectMindGetFeatureContextHandler'),
  ProjectMindGetImpactHandler: Symbol.for('ProjectMindGetImpactHandler'),
  ProjectMindGetArchitectureHandler: Symbol.for('ProjectMindGetArchitectureHandler'),
  ProjectMindGetHistoryHandler: Symbol.for('ProjectMindGetHistoryHandler'),
  ProjectMindGetHealthHandler: Symbol.for('ProjectMindGetHealthHandler'),
  ProjectMindExplainContextHandler: Symbol.for('ProjectMindExplainContextHandler'),
  ProjectMindRefreshContextHandler: Symbol.for('ProjectMindRefreshContextHandler'),
  ProjectMindReportExecutionHandler: Symbol.for('ProjectMindReportExecutionHandler'),
  ProjectMindReportVerificationHandler: Symbol.for('ProjectMindReportVerificationHandler'),
  ProjectMindUpdateKnowledgeHandler: Symbol.for('ProjectMindUpdateKnowledgeHandler'),

  // Phase 7.4 Context Tool Handlers
  ProjectMindStartTaskContextHandler: Symbol.for('ProjectMindStartTaskContextHandler'),
  ProjectMindGetCurrentContextHandler: Symbol.for('ProjectMindGetCurrentContextHandler'),
  ProjectMindRefreshTaskContextHandler: Symbol.for('ProjectMindRefreshTaskContextHandler'),
  ProjectMindUpdateTaskContextHandler: Symbol.for('ProjectMindUpdateTaskContextHandler'),
  ProjectMindPinContextHandler: Symbol.for('ProjectMindPinContextHandler'),
  ProjectMindUnpinContextHandler: Symbol.for('ProjectMindUnpinContextHandler'),
  ProjectMindReportContextFeedbackHandler: Symbol.for('ProjectMindReportContextFeedbackHandler'),

  // Phase 7.5 Task Runtime Tool Handlers
  ProjectMindStartTaskHandler: Symbol.for('ProjectMindStartTaskHandler'),
  ProjectMindGetTaskHandler: Symbol.for('ProjectMindGetTaskHandler'),
  ProjectMindGetTaskStateHandler: Symbol.for('ProjectMindGetTaskStateHandler'),
  ProjectMindGetTaskProgressHandler: Symbol.for('ProjectMindGetTaskProgressHandler'),
  ProjectMindUpdateTaskHandler: Symbol.for('ProjectMindUpdateTaskHandler'),
  ProjectMindCompleteTaskHandler: Symbol.for('ProjectMindCompleteTaskHandler'),
  ProjectMindResumeTaskHandler: Symbol.for('ProjectMindResumeTaskHandler'),
  ProjectMindCancelTaskHandler: Symbol.for('ProjectMindCancelTaskHandler'),

  // Phase 7.6 Observation Tool Handlers
  ProjectMindGetExecutionObservationsHandler: Symbol.for('ProjectMindGetExecutionObservationsHandler'),
  ProjectMindGetTaskTimelineHandler: Symbol.for('ProjectMindGetTaskTimelineHandler'),
  ProjectMindGetExecutionSummaryHandler: Symbol.for('ProjectMindGetExecutionSummaryHandler'),
  ProjectMindGetObservationConflictsHandler: Symbol.for('ProjectMindGetObservationConflictsHandler'),

  // Phase 7.7 Verification Tool Handlers
  ProjectMindGetVerificationHandler: Symbol.for('ProjectMindGetVerificationHandler'),
  ProjectMindGetVerificationSummaryHandler: Symbol.for('ProjectMindGetVerificationSummaryHandler'),
  ProjectMindGetVerificationTimelineHandler: Symbol.for('ProjectMindGetVerificationTimelineHandler'),
  ProjectMindGetCompletionEvidenceHandler: Symbol.for('ProjectMindGetCompletionEvidenceHandler'),
  ProjectMindGetVerificationConflictsHandler: Symbol.for('ProjectMindGetVerificationConflictsHandler'),
};


