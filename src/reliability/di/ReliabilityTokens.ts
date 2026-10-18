export const ReliabilityTokens = {
  FailureClassifier: Symbol('IFailureClassifier'),
  StartupRecoveryManager: Symbol('IStartupRecoveryManager'),
  GracefulShutdownCoordinator: Symbol('GracefulShutdownCoordinator'),
  ReconciliationService: Symbol('IReconciliationService'),
  DisasterRecoveryManager: Symbol('DisasterRecoveryManager'),
  RecoveryVerifier: Symbol('RecoveryVerifier'),
  DependencyDegradationManager: Symbol('DependencyDegradationManager'),
  ReliabilityTelemetry: Symbol('ReliabilityTelemetry'),
} as const;
