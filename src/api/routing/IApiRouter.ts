import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { RouteDefinition, RouteHandler } from './RouteDefinition.js';

export interface IApiRouter {
  register(route: RouteDefinition): void;
  get(path: string, handler: RouteHandler, options?: Partial<RouteDefinition>): void;
  post(path: string, handler: RouteHandler, options?: Partial<RouteDefinition>): void;
  put(path: string, handler: RouteHandler, options?: Partial<RouteDefinition>): void;
  delete(path: string, handler: RouteHandler, options?: Partial<RouteDefinition>): void;
  patch(path: string, handler: RouteHandler, options?: Partial<RouteDefinition>): void;
  handle(request: ApiRequest): Promise<ApiResponse>;
  getRoutes(): readonly RouteDefinition[];
}
