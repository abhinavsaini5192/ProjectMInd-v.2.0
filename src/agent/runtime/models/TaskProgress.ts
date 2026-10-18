import type { AgentTaskStatus } from '../../context/models/AgentTask.js';
import type { TaskExecutionStatus } from './TaskExecutionState.js';
import type { VerificationStatus } from './TaskVerificationState.js';
import type { TaskBlockReason } from './TaskBlockReason.js';

export const STAGE_PROGRESS_PERCENTAGE: Readonly<Record<AgentTaskStatus, number>> = {
  CREATED: 10,
  ANALYZING: 20,
  READY: 30,
  IN_PROGRESS: 50,
  VERIFYING: 75,
  COMPLETED: 100,
  BLOCKED: 50,
  FAILED: 0,
  CANCELLED: 0,
};

export interface TaskProgress {
  readonly taskId: string;
  readonly currentState: AgentTaskStatus;
  readonly completedSteps: readonly string[];
  readonly executionState: TaskExecutionStatus;
  readonly verificationState: VerificationStatus;
  readonly blocked: boolean;
  readonly blockedReason?: TaskBlockReason | string | undefined;
  readonly lastActivity: Date;
  readonly outstandingConditions: readonly string[];
  readonly stagePercentage: number;
}
