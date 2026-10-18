export const ConcurrencyTokens = {
  ResourceLockManager: Symbol('IResourceLockManager'),
  CoordinationService: Symbol('ICoordinationService'),
  WorkloadLimiter: Symbol('IWorkloadLimiter'),
  RequestCoalescer: Symbol('IRequestCoalescer'),
  ConflictResolver: Symbol('IConflictResolver'),
  StaleLockRecoveryManager: Symbol('StaleLockRecoveryManager'),
  ConcurrencyTelemetry: Symbol('ConcurrencyTelemetry'),
} as const;
