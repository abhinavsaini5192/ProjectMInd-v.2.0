export const ObservationTokens = {
  IObservationStore: Symbol.for('IObservationStore'),
  IObservationNormalizer: Symbol.for('IObservationNormalizer'),
  IObservationValidator: Symbol.for('IObservationValidator'),
  IObservationClassifier: Symbol.for('IObservationClassifier'),
  IObservationCorrelator: Symbol.for('IObservationCorrelator'),
  ObservationConflictResolver: Symbol.for('ObservationConflictResolver'),
  IObservationProcessor: Symbol.for('IObservationProcessor'),
  IObservationQueryService: Symbol.for('IObservationQueryService'),

  // Handlers
  ProjectMindGetExecutionObservationsHandler: Symbol.for('ProjectMindGetExecutionObservationsHandler'),
  ProjectMindGetTaskTimelineHandler: Symbol.for('ProjectMindGetTaskTimelineHandler'),
  ProjectMindGetExecutionSummaryHandler: Symbol.for('ProjectMindGetExecutionSummaryHandler'),
  ProjectMindGetObservationConflictsHandler: Symbol.for('ProjectMindGetObservationConflictsHandler'),
};
