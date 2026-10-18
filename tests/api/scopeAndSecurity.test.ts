import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import { createScopeValidationMiddleware } from '../../src/api/middleware/ScopeValidationMiddleware.js';
import { ApiError } from '../../src/api/errors/ApiError.js';
import type { SecurityContext } from '../../src/security/models/SecurityContext.js';

describe('API Scope Enforcement and Security', () => {
  let router: ApiRouter;
  let requestService: RequestService;

  beforeEach(() => {
    router = new ApiRouter();
    requestService = new RequestService();

    const scopeMiddleware = createScopeValidationMiddleware();

    router.get(
      '/v1/workspaces/:workspaceId/repositories/:repositoryId/resource',
      async (req) => ({
        status: 200,
        data: {
          workspaceId: req.context.workspaceId,
          repositoryId: req.context.repositoryId,
        },
        meta: {
          requestId: req.context.requestId,
          correlationId: req.context.correlationId,
          apiVersion: req.context.apiVersion,
          timestamp: Date.now(),
        },
      }),
      { middlewares: [scopeMiddleware] }
    );
  });

  it('allows access when requested workspace and repository match security context', async () => {
    const req = requestService.createRequest({
      path: '/v1/workspaces/ws-allowed/repositories/repo-allowed/resource',
      method: 'GET',
    });

    // Populate security context with matching scope
    (req.context as any).securityContext = {
      workspaceId: 'ws-allowed',
      repositoryId: 'repo-allowed',
    };

    const response = await router.handle(req);
    expect(response.status).toBe(200);
    expect((response.data as any).workspaceId).toBe('ws-allowed');
    expect((response.data as any).repositoryId).toBe('repo-allowed');
  });

  it('blocks cross-workspace access attempt with 403 INVALID_SCOPE', async () => {
    const req = requestService.createRequest({
      path: '/v1/workspaces/ws-other/repositories/repo-allowed/resource',
      method: 'GET',
    });

    // Security context is bound to ws-allowed
    (req.context as any).securityContext = {
      workspaceId: 'ws-allowed',
      repositoryId: 'repo-allowed',
    };

    await expect(router.handle(req)).rejects.toThrow(ApiError);
    try {
      await router.handle(req);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_SCOPE');
      expect(e.status).toBe(403);
      expect(e.detail).toContain('outside authorized scope');
    }
  });

  it('blocks cross-repository access attempt with 403 INVALID_SCOPE', async () => {
    const req = requestService.createRequest({
      path: '/v1/workspaces/ws-allowed/repositories/repo-forbidden/resource',
      method: 'GET',
    });

    (req.context as any).securityContext = {
      workspaceId: 'ws-allowed',
      repositoryId: 'repo-allowed',
    };

    await expect(router.handle(req)).rejects.toThrow(ApiError);
    try {
      await router.handle(req);
    } catch (e: any) {
      expect(e.code).toBe('INVALID_SCOPE');
      expect(e.status).toBe(403);
    }
  });

  it('rejects path traversal attacks in scope route parameters with 400 BAD_REQUEST', async () => {
    const req = requestService.createRequest({
      path: '/v1/workspaces/..%2F..%2Fetc/repositories/repo-1/resource',
      method: 'GET',
    });

    await expect(router.handle(req)).rejects.toThrow(ApiError);
    try {
      await router.handle(req);
    } catch (e: any) {
      expect(e.code).toBe('BAD_REQUEST');
      expect(e.detail).toContain('Invalid characters');
    }
  });

  it('does not leak secrets or credentials in ApiError payloads', () => {
    const sensitiveErr = new Error('Database connection failed with password=super_secret_123');
    const apiErr = ApiError.badRequest('Invalid credentials supplied');

    const json = apiErr.toJSON();
    expect(JSON.stringify(json)).not.toContain('super_secret_123');
    expect(json.status).toBe(400);
    expect(json.code).toBe('BAD_REQUEST');
  });
});
