import type { ContextRequest } from '../models/ContextRequest.js';
import type { ContextScope } from '../models/ContextScope.js';
import { ContextPlanningError } from '../errors/ContextPlanningError.js';

export class ContextScopeResolver {
  public static resolveScope(request: ContextRequest): ContextScope {
    if (!request.repositoryId || typeof request.repositoryId !== 'string' || request.repositoryId.trim().length === 0) {
      throw new ContextPlanningError('repositoryId is required for context planning', { request });
    }

    if (!request.workspaceId || typeof request.workspaceId !== 'string' || request.workspaceId.trim().length === 0) {
      throw new ContextPlanningError('workspaceId is required for context planning', { request });
    }

    return {
      repositoryId: request.repositoryId.trim(),
      workspaceId: request.workspaceId.trim(),
    };
  }
}
