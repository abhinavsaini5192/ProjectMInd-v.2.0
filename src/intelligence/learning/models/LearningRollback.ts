export interface LearningRollback {
  readonly id: string;
  readonly deployedLearningId: string;
  readonly candidateId: string;
  readonly reason: string;
  readonly initiatedBy: string;
  readonly timestamp: number;
  readonly restoredState?: Record<string, any> | undefined;
  readonly auditNote: string;
}
