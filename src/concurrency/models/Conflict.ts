export type ConflictType =
  | 'VERSION_CONFLICT'
  | 'RESOURCE_LOCK_CONFLICT'
  | 'STALE_RESULT'
  | 'DUPLICATE_OPERATION'
  | 'SCOPE_CONFLICT'
  | 'STATE_TRANSITION_CONFLICT'
  | 'DEPENDENCY_CONFLICT';

export type ConflictResolutionAction =
  | 'RETRY'
  | 'REJECT'
  | 'MERGE'
  | 'IGNORE_DUPLICATE'
  | 'REFRESH'
  | 'MANUAL_REVIEW';

export interface ConcurrencyConflict {
  readonly conflictId: string;
  readonly type: ConflictType;
  readonly resourceKey: string;
  readonly expectedVersion?: number | undefined;
  readonly actualVersion?: number | undefined;
  readonly action: ConflictResolutionAction;
  readonly message: string;
  readonly timestamp: number;
  readonly retryable: boolean;
}

export class ConcurrencyError extends Error {
  public readonly conflict: ConcurrencyConflict;

  constructor(conflict: ConcurrencyConflict) {
    super(conflict.message);
    this.name = 'ConcurrencyError';
    this.conflict = conflict;
  }
}
