import type { ApiRequest, HttpMethod } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { ApiMiddleware } from '../middleware/ApiMiddleware.js';
import type { RequestValidator } from '../middleware/ValidationMiddleware.js';
import type { RateLimitPolicy } from '../ratelimit/RateLimitPolicy.js';
import type { PermissionAction } from '../../security/models/PermissionAction.js';
import type { ResourceType } from '../../security/models/ResourceType.js';
import type { ResourceScope } from '../../security/models/ResourceScope.js';

export type RouteHandler = (request: ApiRequest) => Promise<ApiResponse>;

export interface RouteDefinition {
  readonly method: HttpMethod;
  readonly path: string;
  readonly handler: RouteHandler;
  readonly middlewares?: readonly ApiMiddleware[] | undefined;
  readonly requireAuth?: boolean | undefined;
  readonly action?: PermissionAction | undefined;
  readonly resourceType?: ResourceType | undefined;
  readonly scopeExtractor?: ((request: ApiRequest) => ResourceScope) | undefined;
  readonly rateLimitPolicy?: RateLimitPolicy | undefined;
  readonly validator?: RequestValidator | undefined;
  readonly summary?: string | undefined;
  readonly description?: string | undefined;
}
