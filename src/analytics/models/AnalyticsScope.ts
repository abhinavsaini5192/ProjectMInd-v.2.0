export type AnalyticsScopeType =
  | 'INSTANCE'
  | 'WORKSPACE'
  | 'PROJECT'
  | 'REPOSITORY'
  | 'PLUGIN'
  | 'AGENT'
  | 'TASK_PLAN';

export interface AnalyticsScopeRef {
  readonly scopeType: AnalyticsScopeType;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly entityId?: string | undefined;
}

export function formatScopeRef(scope: AnalyticsScopeRef): string {
  switch (scope.scopeType) {
    case 'INSTANCE':
      return 'instance:global';
    case 'WORKSPACE':
      return `workspace:${scope.workspaceId ?? 'unknown'}`;
    case 'PROJECT':
      return `project:${scope.workspaceId ?? 'unknown'}/${scope.projectId ?? 'unknown'}`;
    case 'REPOSITORY':
      return `repository:${scope.workspaceId ?? 'unknown'}/${scope.projectId ?? 'unknown'}/${scope.repositoryId ?? 'unknown'}`;
    case 'PLUGIN':
      return `plugin:${scope.entityId ?? 'unknown'}`;
    case 'AGENT':
      return `agent:${scope.entityId ?? 'unknown'}`;
    case 'TASK_PLAN':
      return `task_plan:${scope.entityId ?? 'unknown'}`;
  }
}
