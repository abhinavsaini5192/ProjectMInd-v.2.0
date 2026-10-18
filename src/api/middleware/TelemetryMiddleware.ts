import type { ApiMiddleware } from './ApiMiddleware.js';
import type { ApiRequest } from '../contracts/ApiRequest.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';

export interface TelemetryRecord {
  readonly requestId: string;
  readonly correlationId: string;
  readonly method: string;
  readonly path: string;
  readonly principalId?: string | undefined;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly timestamp: number;
}

export type TelemetryCollector = (record: TelemetryRecord) => void;

export function createTelemetryMiddleware(collector?: TelemetryCollector): ApiMiddleware {
  return async (request: ApiRequest, next) => {
    const start = Date.now();
    let status = 500;

    try {
      const response: ApiResponse = await next();
      status = response.status;
      const durationMs = Date.now() - start;

      if (collector) {
        collector({
          requestId: request.context.requestId,
          correlationId: request.context.correlationId,
          method: request.method,
          path: request.path,
          principalId: request.context.principal?.principalId,
          statusCode: status,
          durationMs,
          timestamp: start,
        });
      }

      return {
        ...response,
        meta: {
          ...response.meta,
          durationMs,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - start;
      if (collector) {
        collector({
          requestId: request.context.requestId,
          correlationId: request.context.correlationId,
          method: request.method,
          path: request.path,
          principalId: request.context.principal?.principalId,
          statusCode: status,
          durationMs,
          timestamp: start,
        });
      }
      throw error;
    }
  };
}
