import type { ApiMiddleware } from './ApiMiddleware.js';
import type { IAuthorizer } from '../../security/interfaces/IAuthorizer.js';
import type { PermissionAction } from '../../security/models/PermissionAction.js';
import type { ResourceType } from '../../security/models/ResourceType.js';
import type { ResourceScope } from '../../security/models/ResourceScope.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import { ApiError } from '../errors/ApiError.js';

export interface AuthorizationMiddlewareOptions {
  readonly authorizer: IAuthorizer;
  readonly action: PermissionAction;
  readonly resourceType: ResourceType;
  readonly scopeExtractor?: (request: ApiRequest) => ResourceScope;
}

export function createAuthorizationMiddleware(
  options: AuthorizationMiddlewareOptions
): ApiMiddleware {
  const { authorizer, action, resourceType, scopeExtractor } = options;

  return async (request, next) => {
    const principal = request.context.principal;
    if (!principal) {
      throw ApiError.unauthenticated('Authentication required before authorization check');
    }

    const scope: ResourceScope = scopeExtractor
      ? scopeExtractor(request)
      : {
          workspaceId: request.context.workspaceId,
          repositoryId: request.context.repositoryId,
        };

    const authzResult = await authorizer.authorize({
      principal,
      action,
      resourceType,
      resourceId: request.params['id'] || request.params['featureId'] || request.params['sessionId'] || request.params['taskId'],
      scope,
      context: request.context.securityContext,
    });

    if (!authzResult.allowed) {
      throw ApiError.forbidden(authzResult.reason ?? 'Permission denied');
    }

    return next();
  };
}
