import type { ApiMiddleware } from './ApiMiddleware.js';
import { ApiError } from '../errors/ApiError.js';

export function createScopeValidationMiddleware(): ApiMiddleware {
  return async (request, next) => {
    const secCtx = request.context.securityContext;

    // Validate path parameter characters (prevent directory traversal or injection in resource IDs)
    const invalidPattern = /(\.\.|\/|\\)/;
    for (const [key, value] of Object.entries(request.params)) {
      if (['workspaceId', 'repositoryId', 'sessionId', 'taskId', 'featureId'].includes(key)) {
        if (invalidPattern.test(value)) {
          throw ApiError.badRequest(`Invalid characters in route parameter '${key}'`);
        }
      }
    }

    const paramWorkspace = request.params['workspaceId'];
    if (paramWorkspace && secCtx?.workspaceId && secCtx.workspaceId !== '*' && secCtx.workspaceId !== paramWorkspace) {
      throw ApiError.invalidScope(
        `Access denied: workspace '${paramWorkspace}' is outside authorized scope '${secCtx.workspaceId}'`
      );
    }

    const paramRepo = request.params['repositoryId'];
    if (paramRepo && secCtx?.repositoryId && secCtx.repositoryId !== '*' && secCtx.repositoryId !== paramRepo) {
      throw ApiError.invalidScope(
        `Access denied: repository '${paramRepo}' is outside authorized scope '${secCtx.repositoryId}'`
      );
    }

    // Populate context with validated IDs
    const ctx = request.context as unknown as {
      workspaceId?: string;
      repositoryId?: string;
      sessionId?: string;
      taskId?: string;
      [key: string]: unknown;
    };
    if (paramWorkspace) ctx.workspaceId = paramWorkspace;
    if (paramRepo) ctx.repositoryId = paramRepo;
    if (request.params['sessionId']) ctx.sessionId = request.params['sessionId'];
    if (request.params['taskId']) ctx.taskId = request.params['taskId'];

    return next();
  };
}
