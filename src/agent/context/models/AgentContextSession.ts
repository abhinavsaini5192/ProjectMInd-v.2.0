export type AgentContextSessionStatus =
  | 'CREATED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'STALE'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface AgentContextSession {
  readonly contextSessionId: string;
  readonly agentSessionId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly taskId: string;
  readonly taskText: string;
  readonly taskIntent: string;
  readonly status: AgentContextSessionStatus;
  readonly currentContextVersion: number;
  readonly currentKnowledgeVersion: string;
  readonly currentContextPackageId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly lastContextRefreshAt: Date;
  readonly lastReportedChangeAt?: Date | undefined;
  readonly metadata: Record<string, unknown>;
}

export interface CreateContextSessionParams {
  readonly agentSessionId: string;
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly taskText: string;
  readonly taskId?: string | undefined;
  readonly taskTitle?: string | undefined;
  readonly taskIntent?: string | undefined;
  readonly featureIds?: readonly string[] | undefined;
  readonly resourceIds?: readonly string[] | undefined;
  readonly changedResources?: readonly string[] | undefined;
  readonly tokenBudget?: number | undefined;
  readonly requestedSections?: readonly string[] | undefined;
  readonly freshnessPolicy?: 'CURRENT' | 'ALLOW_STALE' | 'ANY' | undefined;
  readonly compactMode?: boolean | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
