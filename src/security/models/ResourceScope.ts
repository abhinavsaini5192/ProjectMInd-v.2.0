export interface ResourceScope {
  readonly global?: boolean | undefined;
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly featureId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly sessionId?: string | undefined;
}

/**
 * Checks whether requestScope is within authorizedScope.
 * Follows strict hierarchical containment:
 * - If authorized is global: allows all.
 * - If authorized has workspaceId: request must match that workspaceId.
 * - If authorized has projectId: request must match that projectId.
 * - If authorized has repositoryId: request must match that repositoryId.
 * - If authorized has taskId: request must match that taskId.
 * - If authorized has sessionId: request must match that sessionId.
 */
export function isScopeContainedWithin(requestScope: ResourceScope, authorizedScope: ResourceScope): boolean {
  if (authorizedScope.global) {
    return true;
  }

  // If authorized scope specifies workspaceId, requestScope must match
  if (authorizedScope.workspaceId !== undefined) {
    if (!requestScope.workspaceId || requestScope.workspaceId !== authorizedScope.workspaceId) {
      return false;
    }
  }

  // If authorized scope specifies projectId, requestScope must match
  if (authorizedScope.projectId !== undefined) {
    if (!requestScope.projectId || requestScope.projectId !== authorizedScope.projectId) {
      return false;
    }
  }

  // If authorized scope specifies repositoryId, requestScope must match
  if (authorizedScope.repositoryId !== undefined) {
    if (!requestScope.repositoryId || requestScope.repositoryId !== authorizedScope.repositoryId) {
      return false;
    }
  }

  // If authorized scope specifies featureId, requestScope cannot conflict
  if (authorizedScope.featureId !== undefined) {
    if (requestScope.featureId !== undefined && requestScope.featureId !== authorizedScope.featureId) {
      return false;
    }
  }

  // If authorized scope specifies taskId, requestScope cannot conflict
  if (authorizedScope.taskId !== undefined) {
    if (requestScope.taskId !== undefined && requestScope.taskId !== authorizedScope.taskId) {
      return false;
    }
  }

  // If authorized scope specifies sessionId, requestScope cannot conflict
  if (authorizedScope.sessionId !== undefined) {
    if (requestScope.sessionId !== undefined && requestScope.sessionId !== authorizedScope.sessionId) {
      return false;
    }
  }

  return true;
}

export function formatScope(scope: ResourceScope): string {
  if (scope.global) {
    return 'global';
  }
  const parts: string[] = [];
  if (scope.workspaceId) parts.push(`ws:${scope.workspaceId}`);
  if (scope.projectId) parts.push(`proj:${scope.projectId}`);
  if (scope.repositoryId) parts.push(`repo:${scope.repositoryId}`);
  if (scope.featureId) parts.push(`feature:${scope.featureId}`);
  if (scope.taskId) parts.push(`task:${scope.taskId}`);
  if (scope.sessionId) parts.push(`sess:${scope.sessionId}`);
  return parts.length > 0 ? parts.join('/') : 'unscoped';
}
