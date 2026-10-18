import type { FailureRecord, FailureCategory, FailureSeverity } from '../models/FailureClassification.js';

export interface FailureClassificationContext {
  readonly operation?: string | undefined;
  readonly resource?: string | undefined;
  readonly context?: Record<string, unknown> | undefined;
}

export interface IFailureClassifier {
  /**
   * Deterministically classifies an unknown error into a structured FailureRecord.
   */
  classify(error: unknown, context?: FailureClassificationContext): FailureRecord;

  /**
   * Returns true if the error represents a retryable condition.
   */
  isRetryable(error: unknown): boolean;
}
