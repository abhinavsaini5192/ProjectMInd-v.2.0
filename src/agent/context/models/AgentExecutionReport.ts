import type { AgentChangeSet } from './AgentChangeSet.js';

export type ExecutionReportStatus =
  | 'STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'PARTIAL'
  | 'CANCELLED';

export interface AgentExecutionReport {
  readonly reportId: string;
  readonly taskId: string;
  readonly contextSessionId: string;
  readonly agentSessionId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly changedResources: readonly string[];
  readonly operations: readonly string[];
  readonly status: ExecutionReportStatus;
  readonly summary: string;
  readonly timestamp: Date;
  readonly changeSet?: AgentChangeSet | undefined;
  readonly metadata: Record<string, unknown>;
}

export interface AgentExecutionReportParams {
  readonly taskId: string;
  readonly contextSessionId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly changedResources?: readonly string[] | undefined;
  readonly modifiedFiles?: readonly string[] | undefined;
  readonly operations?: readonly string[] | undefined;
  readonly status: ExecutionReportStatus;
  readonly summary: string;
  readonly changeSet?: AgentChangeSet | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
