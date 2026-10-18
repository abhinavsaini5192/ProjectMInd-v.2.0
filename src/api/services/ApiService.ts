import type { IApiService } from './IApiService.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IApiRouter } from '../routing/IApiRouter.js';
import { ApiRouter } from '../routing/ApiRouter.js';
import { ApiMiddlewarePipeline } from '../middleware/ApiMiddleware.js';
import { createCorrelationMiddleware } from '../middleware/CorrelationMiddleware.js';
import { createErrorHandlingMiddleware } from '../middleware/ErrorHandlingMiddleware.js';
import { createTelemetryMiddleware, type TelemetryCollector } from '../middleware/TelemetryMiddleware.js';
import { VersionResolver } from '../versioning/VersionResolver.js';
import { ApiCompatibility } from '../versioning/ApiCompatibility.js';
import { isSupportedVersion, isDeprecatedVersion } from '../versioning/ApiVersion.js';
import { ApiError } from '../errors/ApiError.js';

export interface ApiServiceOptions {
  readonly router?: IApiRouter | undefined;
  readonly telemetryCollector?: TelemetryCollector | undefined;
  readonly compatibility?: ApiCompatibility | undefined;
}

export class ApiService implements IApiService {
  private readonly router: IApiRouter;
  private readonly globalPipeline: ApiMiddlewarePipeline;
  private readonly versionResolver: VersionResolver;
  private readonly compatibility: ApiCompatibility;

  public constructor(options?: ApiServiceOptions | undefined) {
    this.router = options?.router ?? new ApiRouter();
    this.versionResolver = new VersionResolver();
    this.compatibility = options?.compatibility ?? new ApiCompatibility();
    this.globalPipeline = new ApiMiddlewarePipeline();

    this.setupGlobalPipeline(options?.telemetryCollector);
  }

  private setupGlobalPipeline(telemetryCollector?: TelemetryCollector): void {
    // 1. Error Handling Boundary (catches downstream errors and wraps as RFC 7807 problem details)
    this.globalPipeline.use(createErrorHandlingMiddleware());

    // 2. Correlation & Request Tracking
    this.globalPipeline.use(createCorrelationMiddleware());

    // 3. Telemetry & Latency measurement
    this.globalPipeline.use(createTelemetryMiddleware(telemetryCollector));

    // 4. API Versioning Resolution & Enforcement
    this.globalPipeline.use(async (request, next) => {
      const resolution = this.versionResolver.resolve(request.path, request.headers);

      if (!resolution.isSupported) {
        throw ApiError.unsupportedVersion(resolution.version);
      }

      // Mutate context with resolved version
      const ctx = request.context as unknown as { apiVersion: string };
      ctx.apiVersion = resolution.version;

      const response = await next();

      // Check if version is deprecated and attach deprecation headers
      if (isDeprecatedVersion(resolution.version)) {
        const depHeaders = this.compatibility.getDeprecationHeaders(resolution.version);
        return {
          ...response,
          headers: {
            ...(response.headers ?? {}),
            ...depHeaders,
          },
        };
      }

      return response;
    });
  }

  public getRouter(): IApiRouter {
    return this.router;
  }

  public getMiddlewarePipeline(): ApiMiddlewarePipeline {
    return this.globalPipeline;
  }

  public async handle(request: ApiRequest): Promise<ApiResponse> {
    return this.globalPipeline.execute(request, async (req) => {
      return this.router.handle(req);
    });
  }
}
