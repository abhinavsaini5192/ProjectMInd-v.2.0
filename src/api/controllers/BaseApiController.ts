import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import type { IApiRouter } from '../routing/IApiRouter.js';

export abstract class BaseApiController {
  public abstract registerRoutes(router: IApiRouter): void;

  protected ok<T>(
    request: ApiRequest,
    data: T,
    headers?: Record<string, string>
  ): ApiResponse<T> {
    return {
      status: 200,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      data,
      meta: {
        requestId: request.context.requestId,
        correlationId: request.context.correlationId,
        timestamp: Date.now(),
        apiVersion: request.context.apiVersion,
      },
    };
  }

  protected created<T>(
    request: ApiRequest,
    data: T,
    location?: string,
    headers?: Record<string, string>
  ): ApiResponse<T> {
    const responseHeaders: Record<string, string> = {
      'content-type': 'application/json',
      ...headers,
    };
    if (location) {
      responseHeaders['location'] = location;
    }

    return {
      status: 201,
      headers: responseHeaders,
      data,
      meta: {
        requestId: request.context.requestId,
        correlationId: request.context.correlationId,
        timestamp: Date.now(),
        apiVersion: request.context.apiVersion,
      },
    };
  }

  protected accepted<T>(
    request: ApiRequest,
    data: T,
    headers?: Record<string, string>
  ): ApiResponse<T> {
    return {
      status: 202,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
      data,
      meta: {
        requestId: request.context.requestId,
        correlationId: request.context.correlationId,
        timestamp: Date.now(),
        apiVersion: request.context.apiVersion,
      },
    };
  }

  protected noContent(request: ApiRequest): ApiResponse<null> {
    return {
      status: 204,
      headers: {},
      data: null,
      meta: {
        requestId: request.context.requestId,
        correlationId: request.context.correlationId,
        timestamp: Date.now(),
        apiVersion: request.context.apiVersion,
      },
    };
  }
}
