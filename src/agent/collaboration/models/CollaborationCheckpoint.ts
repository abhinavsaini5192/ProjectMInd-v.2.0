export interface CollaborationCheckpoint {
  readonly checkpointId: string;
  readonly collaborationSessionId: string;
  readonly version: number;
  readonly snapshotTimestamp: number;
  readonly sessionStatus: string;
  readonly activeTasks: readonly string[];
  readonly taskOwnerships: readonly any[];
  readonly activeReservations: readonly any[];
  readonly openConflicts: readonly string[];
  readonly blockers: readonly string[];
  readonly knowledgeVersion?: string | undefined;
  readonly pendingHandoffs: readonly string[];
  readonly metadata?: Record<string, unknown> | undefined;
}
