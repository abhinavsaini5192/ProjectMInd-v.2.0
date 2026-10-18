import type { AgentTask } from '../../context/models/AgentTask.js';
import type { TaskExecutionState } from './TaskExecutionState.js';
import type { TaskVerificationState } from './TaskVerificationState.js';
import type { TaskBlockReason } from './TaskBlockReason.js';

export interface TaskRuntimeSnapshot {
  readonly task: AgentTask;
  readonly agentSessionId: string;
  readonly contextSessionId: string;
  readonly executionState: TaskExecutionState;
  readonly verificationState: TaskVerificationState;
  readonly currentContextVersion: number;
  readonly knowledgeVersion?: number | undefined;
  readonly blockingState?: {
    readonly isBlocked: boolean;
    readonly reason?: TaskBlockReason | string | undefined;
    readonly details?: string | undefined;
  } | undefined;
  readonly taskVersion: number;
  readonly lease?: {
    readonly owner: string;
    readonly expiresAt: Date;
  } | undefined;
  readonly timestamps: {
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly startedAt?: Date | undefined;
    readonly completedAt?: Date | undefined;
  };
}
