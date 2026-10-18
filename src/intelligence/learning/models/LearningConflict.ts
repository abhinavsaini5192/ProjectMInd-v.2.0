export type ConflictType =
  | 'CONTRADICTORY_EVALUATION'
  | 'SCOPE_MISMATCH'
  | 'AUTHORITY_MISMATCH'
  | 'TEMPORAL_DRIFT';

export interface LearningConflict {
  readonly id: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly feedbackAId: string;
  readonly feedbackBId: string;
  readonly claimA: string;
  readonly claimB: string;
  readonly conflictType: ConflictType;
  readonly detectedAt: number;
  readonly resolution?: string | undefined;
  readonly resolvedScope?: string | undefined;
}
