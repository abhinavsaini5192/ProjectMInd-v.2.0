import type { CompletionEvidence } from '../../../verification/models/CompletionEvidence.js';

export type TaskCompletionStatus =
  | 'READY_TO_COMPLETE'
  | 'NOT_READY'
  | 'BLOCKED'
  | 'INVALID';

export interface TaskCompletionValidationResult {
  readonly status: TaskCompletionStatus;
  readonly canComplete: boolean;
  readonly missingConditions: readonly string[];
  readonly reasons: readonly string[];
  readonly evaluatedAt: Date;
  readonly completionEvidence?: CompletionEvidence | undefined;
}

