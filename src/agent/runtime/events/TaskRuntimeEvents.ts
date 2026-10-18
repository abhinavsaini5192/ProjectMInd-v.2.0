import type { AgentTaskStatus } from '../../context/models/AgentTask.js';

export const TaskRuntimeEvents = {
  TASK_CREATED: 'agent.task.created',
  TASK_ANALYZING: 'agent.task.analyzing',
  TASK_READY: 'agent.task.ready',
  TASK_STARTED: 'agent.task.started',
  TASK_BLOCKED: 'agent.task.blocked',
  TASK_RESUMED: 'agent.task.resumed',
  TASK_VERIFICATION_STARTED: 'agent.task.verification_started',
  TASK_COMPLETED: 'agent.task.completed',
  TASK_FAILED: 'agent.task.failed',
  TASK_CANCELLED: 'agent.task.cancelled',
  TASK_LEASE_ACQUIRED: 'agent.task.lease_acquired',
  TASK_LEASE_RELEASED: 'agent.task.lease_released',
  TASK_EXECUTION_REPORTED: 'agent.task.execution_reported',
  TASK_VERIFICATION_REPORTED: 'agent.task.verification_reported',
} as const;

export type TaskRuntimeEventType = (typeof TaskRuntimeEvents)[keyof typeof TaskRuntimeEvents];

export interface TaskLifecycleEventPayload {
  readonly taskId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly agentSessionId: string;
  readonly previousState: AgentTaskStatus;
  readonly currentState: AgentTaskStatus;
  readonly timestamp: string;
  readonly taskVersion: number;
  readonly reason?: string | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}

export interface TaskLeaseEventPayload {
  readonly taskId: string;
  readonly agentSessionId: string;
  readonly leaseExpiresAt: string;
  readonly timestamp: string;
}
