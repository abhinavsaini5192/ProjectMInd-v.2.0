import type { ApiMiddleware } from './ApiMiddleware.js';
import type { IIdempotencyService } from '../idempotency/IIdempotencyService.js';
import type { ApiResponse } from '../contracts/ApiResponse.js';

export interface IdempotencyMiddlewareOptions {
  readonly idempotencyService: IIdempotencyService;
}

export function createIdempotencyMiddleware(
  optionsOrService: IdempotencyMiddlewareOptions | IIdempotencyService
): ApiMiddleware {
  const idempotencyService = 'beginOperation' in optionsOrService
    ? optionsOrService
    : optionsOrService.idempotencyService;

  return async (request, next) => {
    // Only apply idempotency to mutating requests
    const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    if (!mutatingMethods.includes(request.method)) {
      return next();
    }

    const key =
      request.headers['idempotency-key'] ||
      request.headers['Idempotency-Key'] ||
      request.headers['x-idempotency-key'] ||
      request.headers['X-Idempotency-Key'];

    if (!key || typeof key !== 'string' || key.trim().length === 0) {
      return next();
    }

    const principalId = request.context.principal?.principalId ?? 'anonymous';
    const checkResult = await idempotencyService.beginOperation(
      key.trim(),
      principalId,
      request.path,
      request.body
    );

    if (checkResult.isReplay && checkResult.record) {
      const rec = checkResult.record;
      const replayResponse: ApiResponse = {
        status: rec.responseStatus ?? 200,
        headers: {
          ...(rec.responseHeaders ?? {}),
          'idempotent-replayed': 'true',
        },
        data: rec.responseBody,
        meta: {
          requestId: request.context.requestId,
          correlationId: request.context.correlationId,
          timestamp: Date.now(),
          apiVersion: request.context.apiVersion,
        },
      };
      return replayResponse;
    }

    try {
      const response = await next();
      await idempotencyService.completeOperation(
        key.trim(),
        response.status,
        response.headers ?? {},
        response.data
      );
      return response;
    } catch (error) {
      await idempotencyService.failOperation(key.trim(), error);
      throw error;
    }
  };
}
