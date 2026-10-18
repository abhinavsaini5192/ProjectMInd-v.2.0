export interface InconsistencyRecord {
  readonly resourceId: string;
  readonly type: 'VERSION_MISMATCH' | 'MISSING_DERIVED_STATE' | 'STALE_INDEX' | 'ORPHANED_RELATION';
  readonly sourceVersion: number;
  readonly derivedVersion?: number | undefined;
  readonly description: string;
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ReconciliationPlan {
  readonly inconsistencies: readonly InconsistencyRecord[];
  readonly actions: readonly string[];
  readonly requiresManualReview: boolean;
}

export interface ReconciliationReport {
  readonly inconsistenciesDetected: number;
  readonly inconsistenciesResolved: number;
  readonly actionsApplied: readonly string[];
  readonly manualReviewItems: readonly InconsistencyRecord[];
  readonly durationMs: number;
}

export interface IReconciliationService {
  /**
   * Inspects repository knowledge structures for consistency between source and derived state.
   */
  inspectConsistency(repositoryId: string): Promise<ReconciliationPlan>;

  /**
   * Reconciles detected inconsistencies without silently destroying ambiguous data.
   */
  reconcileRepository(repositoryId: string): Promise<ReconciliationReport>;

  /**
   * Reconciles all registered repositories.
   */
  reconcileAll(): Promise<ReconciliationReport>;
}
