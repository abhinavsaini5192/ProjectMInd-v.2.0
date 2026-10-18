import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import { createAuthenticationMiddleware } from '../../src/api/middleware/AuthenticationMiddleware.js';
import { createAuthorizationMiddleware } from '../../src/api/middleware/AuthorizationMiddleware.js';
import { ApiError } from '../../src/api/errors/ApiError.js';
import type { IAuthenticator } from '../../src/security/interfaces/IAuthenticator.js';
import {
  type AuthenticationResult,
  createAuthSuccess,
  createAuthFailure,
} from '../../src/security/models/AuthenticationResult.js';
import type { ISecurityContextManager } from '../../src/security/interfaces/ISecurityContextManager.js';
import type { IAuthorizer, AuthorizationRequest } from '../../src/security/interfaces/IAuthorizer.js';
import type { AuthorizationResult } from '../../src/security/models/AuthorizationResult.js';
import type { SecurityPrincipal } from '../../src/security/models/SecurityPrincipal.js';
import type { SecurityContext } from '../../src/security/models/SecurityContext.js';

describe('API Authentication and Authorization Integration', () => {
  let router: ApiRouter;
  let requestService: RequestService;
  let mockAuthenticator: IAuthenticator;
  let mockContextManager: ISecurityContextManager;
  let mockAuthorizer: IAuthorizer;

  const validPrincipal: SecurityPrincipal = {
    principalId: 'user-42',
    type: 'USER',
    identityId: 'ident-42',
    displayName: 'Authorized Developer',
    status: 'ACTIVE',
    authenticationMethod: 'API_KEY',
    createdAt: new Date().toISOString(),
  };

  const validContext: SecurityContext = {
    principal: validPrincipal,
    workspaceId: 'ws-prod',
    repositoryId: 'repo-prod',
    permissions: ['workspace:read', 'feature:read', 'context:orchestrate'],
    capabilities: ['code_read'],
    authenticationMethod: 'API_KEY',
    trustLevel: 'VERIFIED',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    router = new ApiRouter();
    requestService = new RequestService();

    mockAuthenticator = {
      authenticate: async (input) => {
        if (input.method === 'API_KEY' && input.apiKey === 'secret-valid-key') {
          return createAuthSuccess(validPrincipal, 'API_KEY');
        }
        if (input.method === 'JWT' && input.token === 'valid.jwt.token') {
          return createAuthSuccess(validPrincipal, 'JWT');
        }
        if (input.method === 'API_KEY' && input.apiKey === 'disabled-user-key') {
          return createAuthFailure('IDENTITY_DISABLED', 'Identity is disabled');
        }
        return createAuthFailure('INVALID_CREDENTIALS', 'Invalid authentication credentials');
      },
    };

    mockContextManager = {
      createContext: async () => validContext,
      validateContext: () => {},
    };

    mockAuthorizer = {
      authorize: async (req: AuthorizationRequest): Promise<AuthorizationResult> => {
        if (req.action === 'READ' && req.resourceType === 'FEATURE') {
          return { allowed: true, reason: 'Permission granted', warnings: [] };
        }
        if (req.action === 'DELETE') {
          return { allowed: false, reason: 'Insufficient privileges for delete', warnings: [] };
        }
        return { allowed: false, reason: 'Default deny', warnings: [] };
      },
    };
  });

  it('rejects unauthenticated requests when authentication middleware is applied', async () => {
    const authMiddleware = createAuthenticationMiddleware({
      authenticator: mockAuthenticator,
      securityContextManager: mockContextManager,
    });

    router.get('/v1/secure', async (req) => ({
      status: 200,
      data: { secure: true },
      meta: {
        requestId: req.context.requestId,
        correlationId: req.context.correlationId,
        apiVersion: req.context.apiVersion,
        timestamp: Date.now(),
      },
    }), { middlewares: [authMiddleware] });

    const reqWithoutAuth = requestService.createRequest({
      path: '/v1/secure',
      method: 'GET',
    });

    await expect(router.handle(reqWithoutAuth)).rejects.toThrow(ApiError);
    try {
      await router.handle(reqWithoutAuth);
    } catch (e: any) {
      expect(e.code).toBe('UNAUTHENTICATED');
      expect(e.status).toBe(401);
    }
  });

  it('authenticates request via X-API-Key header and populates ApiRequestContext', async () => {
    const authMiddleware = createAuthenticationMiddleware({
      authenticator: mockAuthenticator,
      securityContextManager: mockContextManager,
    });

    router.get('/v1/secure', async (req) => ({
      status: 200,
      data: {
        principalId: req.context.principal.principalId,
        authMethod: req.context.principal.authenticationMethod,
      },
      meta: {
        requestId: req.context.requestId,
        correlationId: req.context.correlationId,
        apiVersion: req.context.apiVersion,
        timestamp: Date.now(),
      },
    }), { middlewares: [authMiddleware] });

    const req = requestService.createRequest({
      path: '/v1/secure',
      method: 'GET',
      headers: {
        'x-api-key': 'secret-valid-key',
      },
    });

    const response = await router.handle(req);
    expect(response.status).toBe(200);
    expect((response.data as any).principalId).toBe('user-42');
    expect((response.data as any).authMethod).toBe('API_KEY');
  });

  it('authenticates request via Authorization Bearer header', async () => {
    const authMiddleware = createAuthenticationMiddleware({
      authenticator: mockAuthenticator,
      securityContextManager: mockContextManager,
    });

    router.get('/v1/bearer-secure', async (req) => ({
      status: 200,
      data: { principalId: req.context.principal.principalId },
      meta: {
        requestId: req.context.requestId,
        correlationId: req.context.correlationId,
        apiVersion: req.context.apiVersion,
        timestamp: Date.now(),
      },
    }), { middlewares: [authMiddleware] });

    const req = requestService.createRequest({
      path: '/v1/bearer-secure',
      method: 'GET',
      headers: {
        authorization: 'Bearer valid.jwt.token',
      },
    });

    const response = await router.handle(req);
    expect(response.status).toBe(200);
    expect((response.data as any).principalId).toBe('user-42');
  });

  it('rejects disabled identities with 401 UNAUTHENTICATED', async () => {
    const authMiddleware = createAuthenticationMiddleware({
      authenticator: mockAuthenticator,
      securityContextManager: mockContextManager,
    });

    router.get('/v1/secure', async (req) => ({
      status: 200,
      data: {},
      meta: {
        requestId: req.context.requestId,
        correlationId: req.context.correlationId,
        apiVersion: req.context.apiVersion,
        timestamp: Date.now(),
      },
    }), { middlewares: [authMiddleware] });

    const req = requestService.createRequest({
      path: '/v1/secure',
      method: 'GET',
      headers: {
        'x-api-key': 'disabled-user-key',
      },
    });

    await expect(router.handle(req)).rejects.toThrow(ApiError);
    try {
      await router.handle(req);
    } catch (e: any) {
      expect(e.code).toBe('UNAUTHENTICATED');
      expect(e.detail).toContain('disabled');
    }
  });

  it('allows access when authorizer permits operation', async () => {
    const authMiddleware = createAuthenticationMiddleware({
      authenticator: mockAuthenticator,
      securityContextManager: mockContextManager,
    });

    const authzMiddleware = createAuthorizationMiddleware({
      authorizer: mockAuthorizer,
      action: 'READ',
      resourceType: 'FEATURE',
    });

    router.get('/v1/features/:id', async (req) => ({
      status: 200,
      data: { featureId: req.params['id'] },
      meta: {
        requestId: req.context.requestId,
        correlationId: req.context.correlationId,
        apiVersion: req.context.apiVersion,
        timestamp: Date.now(),
      },
    }), { middlewares: [authMiddleware, authzMiddleware] });

    const req = requestService.createRequest({
      path: '/v1/features/feat-auth',
      method: 'GET',
      headers: { 'x-api-key': 'secret-valid-key' },
    });

    const response = await router.handle(req);
    expect(response.status).toBe(200);
    expect((response.data as any).featureId).toBe('feat-auth');
  });

  it('denies access with 403 FORBIDDEN when authorizer denies action', async () => {
    const authMiddleware = createAuthenticationMiddleware({
      authenticator: mockAuthenticator,
      securityContextManager: mockContextManager,
    });

    const authzMiddleware = createAuthorizationMiddleware({
      authorizer: mockAuthorizer,
      action: 'DELETE',
      resourceType: 'FEATURE',
    });

    router.delete('/v1/features/:id', async (req) => ({
      status: 204,
      data: null,
      meta: {
        requestId: req.context.requestId,
        correlationId: req.context.correlationId,
        apiVersion: req.context.apiVersion,
        timestamp: Date.now(),
      },
    }), { middlewares: [authMiddleware, authzMiddleware] });

    const req = requestService.createRequest({
      path: '/v1/features/feat-auth',
      method: 'DELETE',
      headers: { 'x-api-key': 'secret-valid-key' },
    });

    await expect(router.handle(req)).rejects.toThrow(ApiError);
    try {
      await router.handle(req);
    } catch (e: any) {
      expect(e.code).toBe('FORBIDDEN');
      expect(e.status).toBe(403);
    }
  });
});
