import type { ApiMiddleware } from './ApiMiddleware.js';
import type { IAuthenticator, AuthenticationInput } from '../../security/interfaces/IAuthenticator.js';
import type { ISecurityContextManager } from '../../security/interfaces/ISecurityContextManager.js';
import { ApiError } from '../errors/ApiError.js';

export interface AuthenticationMiddlewareOptions {
  readonly authenticator: IAuthenticator;
  readonly securityContextManager: ISecurityContextManager;
  readonly allowAnonymous?: boolean | undefined;
  readonly environment?: 'development' | 'production' | 'staging' | 'test' | undefined;
}

export function createAuthenticationMiddleware(
  options: AuthenticationMiddlewareOptions
): ApiMiddleware {
  const { authenticator, securityContextManager, allowAnonymous = false, environment } = options;

  return async (request, next) => {
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];
    const apiKeyHeader = request.headers['x-api-key'] || request.headers['X-API-Key'];
    const sessionHeader = request.headers['x-session-id'] || request.headers['X-Session-ID'];
    const devHeader = request.headers['x-dev-principal-id'] || request.headers['X-Dev-Principal-ID'];

    const isProductionLike =
      environment === 'production' ||
      environment === 'staging' ||
      process.env.NODE_ENV === 'production' ||
      process.env.NODE_ENV === 'staging';

    let authInput: AuthenticationInput | undefined;

    if (authHeader) {
      const parts = authHeader.trim().split(/\s+/);
      const scheme = parts[0]?.toLowerCase();
      const token = parts[1];

      if (scheme === 'bearer' && token) {
        authInput = { method: 'JWT', token };
      } else if (scheme === 'apikey' && token) {
        authInput = { method: 'API_KEY', apiKey: token };
      }
    } else if (apiKeyHeader) {
      authInput = { method: 'API_KEY', apiKey: apiKeyHeader };
    } else if (sessionHeader) {
      authInput = { method: 'SESSION', sessionId: sessionHeader };
    } else if (devHeader) {
      if (isProductionLike) {
        throw ApiError.unauthenticated('Developer authentication headers (x-dev-principal-id) are strictly prohibited in production and staging');
      }
      authInput = { method: 'LOCAL_DEVELOPMENT', developmentPrincipalId: devHeader };
    }

    if (!authInput) {
      if (allowAnonymous) {
        return next();
      }
      throw ApiError.unauthenticated('Missing or unsupported authorization credentials');
    }

    const authResult = await authenticator.authenticate(authInput);
    if (!authResult.success || !authResult.principal) {
      throw ApiError.unauthenticated(authResult.errorMessage ?? 'Authentication failed');
    }

    const securityContext = await securityContextManager.createContext(authResult.principal, {
      workspaceId: request.context.workspaceId,
      repositoryId: request.context.repositoryId,
      sessionId: request.context.sessionId,
      taskId: request.context.taskId,
      requestId: request.context.requestId,
      correlationId: request.context.correlationId,
    });

    // Populate request context
    const ctx = request.context as unknown as {
      principal: typeof authResult.principal;
      securityContext: typeof securityContext;
      [key: string]: unknown;
    };
    ctx.principal = authResult.principal;
    ctx.securityContext = securityContext;

    return next();
  };
}
