import type { AgentRuntimeState } from './AgentRuntimeState.js';

export interface AgentRuntimeCheckpoint {
  readonly checkpointId: string;
  readonly runtimeId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly adapterId?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly runtimeState: AgentRuntimeState;
  readonly taskState?: string | undefined;
  readonly sessionState?: Record<string, unknown> | undefined;
  readonly knowledgeVersion?: string | undefined;
  readonly contextVersion?: string | undefined;
  readonly lastOperationId?: string | undefined;
  readonly lastObservationId?: string | undefined;
  readonly lastVerificationId?: string | undefined;
  readonly lastKnowledgeUpdateId?: string | undefined;
  readonly activeSessionIds: readonly string[];
  readonly activeTaskIds: readonly string[];
  readonly createdAt: number;
  readonly metadata?: Record<string, unknown> | undefined;
}
