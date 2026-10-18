export interface TaskContextRequirement {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly repositoryIds: readonly string[];
  readonly targetFeatures?: readonly string[] | undefined;
  readonly targetResources?: readonly string[] | undefined;
  readonly memoryQueries?: readonly string[] | undefined;
  readonly upstreamNodeIds?: readonly string[] | undefined;
  readonly contextTokenBudget?: number | undefined;
}
