import type { ApiMiddleware } from './ApiMiddleware.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';
import { ApiErrorMapper } from '../errors/ApiErrorMapper.js';

export function createErrorHandlingMiddleware(): ApiMiddleware {
  return async (request, next) => {
    try {
      return await next();
    } catch (error) {
      const errorResponse = ApiErrorMapper.map(error, request.context);

      const response: ApiResponse = {
        status: errorResponse.status,
        headers: {
          'content-type': 'application/problem+json',
        },
        data: errorResponse,
        meta: {
          requestId: request.context.requestId,
          correlationId: request.context.correlationId,
          timestamp: Date.now(),
          apiVersion: request.context.apiVersion,
        },
      };

      return response;
    }
  };
}
