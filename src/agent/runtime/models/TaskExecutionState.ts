import type { AgentChangeSet } from '../../context/models/AgentChangeSet.js';

export type TaskExecutionStatus =
  | 'NOT_STARTED'
  | 'STARTED'
  | 'IN_PROGRESS'
  | 'RUNNING'
  | 'PARTIAL'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN';

export interface TaskExecutionState {
  readonly executionState: TaskExecutionStatus;
  readonly lastReportId?: string | undefined;
  readonly lastChangeSet?: AgentChangeSet | undefined;
  readonly startedAt?: Date | undefined;
  readonly completedAt?: Date | undefined;
  readonly updatedAt: Date;
  readonly summary?: string | undefined;
  readonly operationHistory: readonly string[];
  readonly evidenceLevel?: string | undefined;
}

export function createInitialTaskExecutionState(): TaskExecutionState {
  return {
    executionState: 'NOT_STARTED',
    updatedAt: new Date(),
    operationHistory: [],
  };
}
