/**
 * Scoped workspace and repository boundary for an agent request.
 */
export interface AgentWorkspaceContext {
  readonly workspaceId: string;
  readonly repositoryId: string;
  readonly revision?: string | undefined;
  readonly branch?: string | undefined;
  readonly taskId?: string | undefined;
  readonly changedResources?: string[] | undefined;
  readonly versions?: Record<string, string> | undefined;
  readonly freshness?: string | undefined;
}
