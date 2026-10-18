import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import { SUPPORTED_API_VERSIONS, DEFAULT_API_VERSION, DEPRECATED_API_VERSIONS } from '../versioning/ApiVersion.js';
import type { CapabilitiesApiResponse } from '../models/responses/CapabilitiesApiResponse.js';

export class CapabilitiesController extends BaseApiController {
  public constructor(private readonly routerRef?: IApiRouter | undefined) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    router.get('/v1/capabilities', this.getCapabilities.bind(this));
    router.get('/capabilities', this.getCapabilities.bind(this));
  }

  public async getCapabilities(request: ApiRequest): Promise<ApiResponse<CapabilitiesApiResponse>> {
    const routes = this.routerRef ? this.routerRef.getRoutes() : [];

    const endpoints = routes.map((r) => ({
      path: r.path,
      method: r.method,
      description: r.description ?? r.summary ?? `${r.method} ${r.path}`,
      requiredPermission: r.action && r.resourceType ? `${r.resourceType}:${r.action}` : undefined,
      idempotent: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].includes(r.method),
    }));

    const response: CapabilitiesApiResponse = {
      version: DEFAULT_API_VERSION,
      supportedVersions: [...SUPPORTED_API_VERSIONS],
      authMethods: ['API_KEY', 'JWT', 'SESSION', 'LOCAL_DEVELOPMENT'],
      endpoints,
      rateLimits: {
        defaultLimit: 120,
        windowMs: 60000,
      },
    };

    return this.ok(request, response);
  }
}
