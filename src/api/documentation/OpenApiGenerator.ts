import type { IApiRouter } from '../routing/IApiRouter.js';
import type { RouteDefinition } from '../routing/RouteDefinition.js';
import { SUPPORTED_API_VERSIONS, DEFAULT_API_VERSION } from '../versioning/ApiVersion.js';

export interface OpenApiSpec {
  readonly openapi: string;
  readonly info: {
    readonly title: string;
    readonly version: string;
    readonly description: string;
  };
  readonly paths: Record<string, Record<string, unknown>>;
  readonly components: {
    readonly securitySchemes: Record<string, unknown>;
    readonly schemas: Record<string, unknown>;
  };
}

export class OpenApiGenerator {
  public static generate(router: IApiRouter): OpenApiSpec {
    const routes = router.getRoutes();
    const paths: Record<string, Record<string, unknown>> = {};

    for (const route of routes) {
      // Convert /v1/workspaces/:workspaceId into OpenAPI path: /v1/workspaces/{workspaceId}
      const openApiPath = route.path.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
      const method = route.method.toLowerCase();

      if (!paths[openApiPath]) {
        paths[openApiPath] = {};
      }

      // Extract path parameter names
      const pathParams = [...route.path.matchAll(/:([a-zA-Z0-9_]+)/g)].map((m) => m[1]);
      const parameters = pathParams.map((p) => ({
        name: p,
        in: 'path',
        required: true,
        schema: { type: 'string' },
        description: `Identifier for ${p}`,
      }));

      // Security requirements
      const security = route.requireAuth !== false
        ? [{ ApiKeyAuth: [] }, { BearerAuth: [] }]
        : [];

      paths[openApiPath]![method] = {
        summary: route.summary ?? `${route.method} ${route.path}`,
        description: route.description ?? (route.action && route.resourceType ? `Requires ${route.resourceType}:${route.action}` : undefined),
        parameters: parameters.length > 0 ? parameters : undefined,
        security: security.length > 0 ? security : undefined,
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'object' },
                    meta: { $ref: '#/components/schemas/ApiMetadata' },
                  },
                  required: ['data', 'meta'],
                },
              },
            },
          },
          '400': {
            description: 'Bad Request / Validation Failure',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
          '401': {
            description: 'Unauthenticated',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
          '403': {
            description: 'Forbidden / Scope Mismatch',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
          '404': {
            description: 'Resource Not Found',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
          '409': {
            description: 'State / Idempotency Conflict',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
          '429': {
            description: 'Rate Limited',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
          '500': {
            description: 'Internal Server Error',
            content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/ProblemDetails' } } },
          },
        },
      };
    }

    return {
      openapi: '3.1.0',
      info: {
        title: 'ProjectMind Canonical API',
        version: DEFAULT_API_VERSION,
        description:
          'AI-native repository intelligence and context optimization platform API boundary. Provider-neutral, versioned, authenticated, authorized, and scoped.',
      },
      paths,
      components: {
        securitySchemes: {
          ApiKeyAuth: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
        schemas: {
          ApiMetadata: {
            type: 'object',
            properties: {
              requestId: { type: 'string' },
              correlationId: { type: 'string' },
              apiVersion: { type: 'string' },
              timestamp: { type: 'integer' },
              durationMs: { type: 'number' },
              pagination: {
                type: 'object',
                properties: {
                  cursor: { type: 'string', nullable: true },
                  nextCursor: { type: 'string', nullable: true },
                  prevCursor: { type: 'string', nullable: true },
                  hasMore: { type: 'boolean' },
                  limit: { type: 'integer' },
                  totalCount: { type: 'integer' },
                },
              },
            },
            required: ['requestId', 'correlationId', 'apiVersion', 'timestamp'],
          },
          ProblemDetails: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              title: { type: 'string' },
              status: { type: 'integer' },
              detail: { type: 'string' },
              code: { type: 'string' },
              instance: { type: 'string' },
              requestId: { type: 'string' },
              correlationId: { type: 'string' },
            },
            required: ['type', 'title', 'status', 'detail', 'code'],
          },
        },
      },
    };
  }
}
