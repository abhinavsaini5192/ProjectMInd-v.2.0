import type { ApiRequest, HttpMethod } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IApiRouter } from './IApiRouter.js';
import type { RouteDefinition, RouteHandler } from './RouteDefinition.js';
import { RouteMatcher, type CompiledRoute } from './RouteMatcher.js';
import { composeMiddleware, type ApiMiddleware } from '../middleware/ApiMiddleware.js';
import { ApiError } from '../errors/ApiError.js';

interface RegisteredRouteItem {
  readonly route: RouteDefinition;
  readonly compiled: CompiledRoute;
}

export class ApiRouter implements IApiRouter {
  private readonly routes: RegisteredRouteItem[] = [];

  public register(route: RouteDefinition): void {
    const compiled = RouteMatcher.compile(route.path);
    this.routes.push({ route, compiled });
  }

  public get(path: string, handler: RouteHandler, options?: Partial<RouteDefinition>): void {
    this.register({ method: 'GET', path, handler, ...options });
  }

  public post(path: string, handler: RouteHandler, options?: Partial<RouteDefinition>): void {
    this.register({ method: 'POST', path, handler, ...options });
  }

  public put(path: string, handler: RouteHandler, options?: Partial<RouteDefinition>): void {
    this.register({ method: 'PUT', path, handler, ...options });
  }

  public delete(path: string, handler: RouteHandler, options?: Partial<RouteDefinition>): void {
    this.register({ method: 'DELETE', path, handler, ...options });
  }

  public patch(path: string, handler: RouteHandler, options?: Partial<RouteDefinition>): void {
    this.register({ method: 'PATCH', path, handler, ...options });
  }

  public getRoutes(): readonly RouteDefinition[] {
    return this.routes.map((item) => item.route);
  }

  public async handle(request: ApiRequest): Promise<ApiResponse> {
    const cleanPath = request.path.split('?')[0] || request.path;

    const pathMatches: RegisteredRouteItem[] = [];
    let exactMatch: { item: RegisteredRouteItem; params: Record<string, string> } | undefined;

    for (const item of this.routes) {
      const matchResult = RouteMatcher.match(item.compiled, cleanPath);
      if (matchResult.matched) {
        pathMatches.push(item);
        if (item.route.method.toUpperCase() === request.method.toUpperCase()) {
          exactMatch = { item, params: matchResult.params };
          break;
        }
      }
    }

    if (!exactMatch) {
      if (pathMatches.length > 0) {
        const allowedMethods = [...new Set(pathMatches.map((m) => m.route.method))];
        throw ApiError.methodNotAllowed(
          `Method '${request.method}' not allowed on '${cleanPath}'. Allowed: ${allowedMethods.join(', ')}`
        );
      }
      throw ApiError.notFound(`Route not found for '${request.method} ${cleanPath}'`);
    }

    // Attach route params to request
    (request as { params: Record<string, string> }).params = exactMatch.params;

    const routeMiddlewares: ApiMiddleware[] = exactMatch.item.route.middlewares
      ? [...exactMatch.item.route.middlewares]
      : [];

    const finalPipeline = composeMiddleware(routeMiddlewares);
    return finalPipeline(request, exactMatch.item.route.handler);
  }
}
