export type AgentTaskStatus =
  | 'CREATED'
  | 'ANALYZING'
  | 'READY'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface AgentTask {
  readonly taskId: string;
  readonly contextSessionId: string;
  readonly agentSessionId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly title: string;
  readonly description: string;
  readonly intent: string;
  readonly status: AgentTaskStatus;
  readonly priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' | undefined;
  readonly createdAt: Date;
  readonly startedAt?: Date | undefined;
  readonly updatedAt: Date;
  readonly completedAt?: Date | undefined;
  readonly lastExecutionReportId?: string | undefined;
  readonly lastVerificationReportId?: string | undefined;
  readonly lastContextVersion?: number | undefined;
  readonly lastKnowledgeVersion?: number | undefined;
  readonly blockedReason?: string | undefined;
  readonly failureReason?: string | undefined;
  readonly taskVersion?: number | undefined;
  readonly leaseOwner?: string | undefined;
  readonly leaseExpiresAt?: Date | undefined;
  readonly modifiedFiles?: readonly string[] | undefined;
  readonly executionPayload?: unknown | undefined;
  readonly verificationStatus?: string | undefined;
  readonly verificationPassed?: boolean | undefined;
  readonly metadata: Record<string, unknown>;
}

export const VALID_TASK_TRANSITIONS: Readonly<Record<AgentTaskStatus, readonly AgentTaskStatus[]>> = {
  CREATED: ['ANALYZING', 'FAILED', 'CANCELLED'],
  ANALYZING: ['READY', 'FAILED', 'CANCELLED'],
  READY: ['IN_PROGRESS', 'FAILED', 'CANCELLED'],
  IN_PROGRESS: ['VERIFYING', 'BLOCKED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'FAILED', 'CANCELLED'],
  VERIFYING: ['COMPLETED', 'IN_PROGRESS', 'BLOCKED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function isValidTaskTransition(from: AgentTaskStatus, to: AgentTaskStatus): boolean {
  if (from === to) return true;
  const allowed = VALID_TASK_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
