import { BaseApiController } from './BaseApiController.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { PlatformHealthService } from '../../platform/health/PlatformHealthService.js';

export class HealthController extends BaseApiController {
  public constructor(private readonly healthService: PlatformHealthService) {
    super();
  }

  public registerRoutes(router: IApiRouter): void {
    // Top-level unversioned and versioned health endpoints
    router.get('/health', this.getHealth.bind(this));
    router.get('/health/live', this.getLiveness.bind(this));
    router.get('/health/ready', this.getReadiness.bind(this));

    router.get('/v1/health', this.getHealth.bind(this));
    router.get('/v1/health/live', this.getLiveness.bind(this));
    router.get('/v1/health/ready', this.getReadiness.bind(this));
  }

  public async getHealth(request: ApiRequest): Promise<ApiResponse> {
    const report = await this.healthService.getHealth();
    const statusCode = report.status === 'UNHEALTHY' ? 503 : report.status === 'DEGRADED' ? 200 : 200;
    return {
      ...this.ok(request, report),
      status: statusCode,
    };
  }

  public async getLiveness(request: ApiRequest): Promise<ApiResponse> {
    const liveness = this.healthService.getLiveness();
    const statusCode = liveness.status === 'alive' ? 200 : 503;
    return {
      ...this.ok(request, liveness),
      status: statusCode,
    };
  }

  public async getReadiness(request: ApiRequest): Promise<ApiResponse> {
    const readiness = await this.healthService.getReadiness();
    const statusCode = readiness.ready ? 200 : 503;
    return {
      ...this.ok(request, readiness),
      status: statusCode,
    };
  }
}
