import type {
  ConcurrencyConflict,
  ConflictType,
  ConflictResolutionAction,
} from '../models/Conflict.js';

export interface ConflictResolutionContext {
  readonly conflictType: ConflictType;
  readonly resourceKey: string;
  readonly expectedVersion?: number | undefined;
  readonly actualVersion?: number | undefined;
  readonly attempt?: number | undefined;
  readonly maxRetries?: number | undefined;
  readonly operation?: string | undefined;
  readonly message?: string | undefined;
}

export interface ConflictResolutionResult {
  readonly conflict: ConcurrencyConflict;
  readonly action: ConflictResolutionAction;
  readonly shouldRetry: boolean;
  readonly backoffDelayMs?: number | undefined;
}

export interface IConflictResolver {
  /**
   * Evaluates a concurrency conflict and determines the deterministic resolution strategy.
   */
  resolve(context: ConflictResolutionContext): ConflictResolutionResult;
}
