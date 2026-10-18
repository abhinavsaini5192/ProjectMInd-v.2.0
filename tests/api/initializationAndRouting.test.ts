import { describe, it, expect, beforeEach } from 'vitest';
import { ApiRouter } from '../../src/api/routing/ApiRouter.js';
import { RouteMatcher } from '../../src/api/routing/RouteMatcher.js';
import { RequestService } from '../../src/api/services/RequestService.js';
import { CapabilitiesController } from '../../src/api/controllers/CapabilitiesController.js';
import { ApiService } from '../../src/api/services/ApiService.js';
import { DIContainer } from '../../src/workspace/di/DIContainer.js';
import { ApiDISetup } from '../../src/api/di/ApiDISetup.js';
import { ApiTokens } from '../../src/api/di/ApiTokens.js';
import { ApiError } from '../../src/api/errors/ApiError.js';

describe('API Initialization and Routing', () => {
  let router: ApiRouter;
  let requestService: RequestService;

  beforeEach(() => {
    router = new ApiRouter();
    requestService = new RequestService();
  });

  it('compiles route patterns and matches dynamic parameters accurately', () => {
    const compiled = RouteMatcher.compile('/v1/workspaces/:workspaceId/repositories/:repositoryId');
    const match = RouteMatcher.match(compiled, '/v1/workspaces/ws-100/repositories/repo-200');

    expect(match.matched).toBe(true);
    expect(match.params['workspaceId']).toBe('ws-100');
    expect(match.params['repositoryId']).toBe('repo-200');
  });

  it('correctly handles root and trailing slashes in route matching', () => {
    const compiled = RouteMatcher.compile('/v1/health');
    expect(RouteMatcher.match(compiled, '/v1/health').matched).toBe(true);
    expect(RouteMatcher.match(compiled, '/v1/health/').matched).toBe(true);
    expect(RouteMatcher.match(compiled, '/v1/health/live').matched).toBe(false);
  });

  it('registers HTTP routes and executes matching handlers', async () => {
    router.get('/v1/ping', async (req) => ({
      status: 200,
      data: { message: 'pong' },
      meta: {
        requestId: req.context.requestId,
        correlationId: req.context.correlationId,
        apiVersion: req.context.apiVersion,
        timestamp: Date.now(),
      },
    }));

    const req = requestService.createRequest({
      path: '/v1/ping',
      method: 'GET',
    });

    const response = await router.handle(req);
    expect(response.status).toBe(200);
    expect((response.data as any).message).toBe('pong');
  });

  it('throws 404 NOT_FOUND for unknown routes', async () => {
    const req = requestService.createRequest({
      path: '/v1/nonexistent',
      method: 'GET',
    });

    await expect(router.handle(req)).rejects.toThrow(ApiError);
    try {
      await router.handle(req);
    } catch (e: any) {
      expect(e.code).toBe('NOT_FOUND');
      expect(e.status).toBe(404);
    }
  });

  it('throws 405 METHOD_NOT_ALLOWED when path matches but method does not', async () => {
    router.post('/v1/items', async (req) => ({
      status: 201,
      data: { created: true },
      meta: {
        requestId: req.context.requestId,
        correlationId: req.context.correlationId,
        apiVersion: req.context.apiVersion,
        timestamp: Date.now(),
      },
    }));

    const req = requestService.createRequest({
      path: '/v1/items',
      method: 'GET',
    });

    await expect(router.handle(req)).rejects.toThrow(ApiError);
    try {
      await router.handle(req);
    } catch (e: any) {
      expect(e.code).toBe('METHOD_NOT_ALLOWED');
      expect(e.status).toBe(405);
    }
  });

  it('exposes machine-readable capabilities through CapabilitiesController', async () => {
    const capabilitiesCtrl = new CapabilitiesController(router);
    capabilitiesCtrl.registerRoutes(router);

    const req = requestService.createRequest({
      path: '/v1/capabilities',
      method: 'GET',
    });

    const response = await router.handle(req);
    expect(response.status).toBe(200);
    const caps = response.data as any;
    expect(caps.version).toBe('v1');
    expect(caps.supportedVersions).toContain('v1');
    expect(caps.authMethods).toContain('API_KEY');
    expect(caps.endpoints).toBeDefined();
    expect(caps.rateLimits).toBeDefined();
  });

  it('resolves all core API tokens through DIContainer', () => {
    const container = new DIContainer();
    ApiDISetup.register(container);

    const resolvedRouter = container.resolve<ApiRouter>(ApiTokens.IApiRouter);
    const resolvedApiService = container.resolve<ApiService>(ApiTokens.IApiService);
    const resolvedWorkspaceCtrl = container.resolve(ApiTokens.WorkspaceController);

    expect(resolvedRouter).toBeDefined();
    expect(resolvedApiService).toBeDefined();
    expect(resolvedWorkspaceCtrl).toBeDefined();
  });
});
