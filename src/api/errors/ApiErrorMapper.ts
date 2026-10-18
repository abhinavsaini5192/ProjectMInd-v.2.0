import { ApiError } from './ApiError.js';
import { ConfigRedactor } from '../../platform/config/ConfigRedactor.js';

export class ApiErrorMapper {
  public static map(
    error: unknown,
    context?: { requestId?: string | undefined; correlationId?: string | undefined; path?: string | undefined }
  ): ApiError {
    if (error instanceof ApiError) {
      const sanitizedDetail = error.detail ? ConfigRedactor.redactString(error.detail) : undefined;
      const sanitizedMessage = ConfigRedactor.redactString(error.message);
      if (context?.requestId || context?.correlationId || context?.path || sanitizedDetail !== error.detail || sanitizedMessage !== error.message) {
        return new ApiError({
          code: error.code,
          message: sanitizedMessage,
          detail: sanitizedDetail,
          status: error.status,
          instance: context?.path ?? error.instance,
          errors: error.errors,
          requestId: context?.requestId ?? error.requestId,
          correlationId: context?.correlationId ?? error.correlationId,
          retryAfter: error.retryAfter,
          cause: error.cause,
        });
      }
      return error;
    }

    if (error instanceof Error) {
      const msg = ConfigRedactor.redactString(error.message);

      // Check common domain error patterns
      if (msg.includes('Authentication') || msg.includes('unauthenticated') || msg.includes('token') || msg.includes('credential')) {
        return new ApiError({
          code: 'UNAUTHENTICATED',
          message: 'Authentication failed',
          detail: msg,
          instance: context?.path,
          requestId: context?.requestId,
          correlationId: context?.correlationId,
          cause: error,
        });
      }

      if (msg.includes('Permission') || msg.includes('denied') || msg.includes('unauthorized') || msg.includes('forbidden')) {
        return new ApiError({
          code: 'FORBIDDEN',
          message: 'Access denied',
          detail: msg,
          instance: context?.path,
          requestId: context?.requestId,
          correlationId: context?.correlationId,
          cause: error,
        });
      }

      if (msg.includes('Scope') || msg.includes('scope mismatch') || msg.includes('Resource scope')) {
        return new ApiError({
          code: 'INVALID_SCOPE',
          message: 'Resource scope violation',
          detail: msg,
          instance: context?.path,
          requestId: context?.requestId,
          correlationId: context?.correlationId,
          cause: error,
        });
      }

      if (msg.includes('not found') || msg.includes('NotFound') || msg.includes('does not exist')) {
        return new ApiError({
          code: 'NOT_FOUND',
          message: 'Resource not found',
          detail: msg,
          instance: context?.path,
          requestId: context?.requestId,
          correlationId: context?.correlationId,
          cause: error,
        });
      }

      if (msg.includes('conflict') || msg.includes('already exists') || msg.includes('duplicate')) {
        return new ApiError({
          code: 'CONFLICT',
          message: 'Resource state conflict',
          detail: msg,
          instance: context?.path,
          requestId: context?.requestId,
          correlationId: context?.correlationId,
          cause: error,
        });
      }

      if (msg.includes('Invalid') || msg.includes('validation') || msg.includes('malformed') || msg.includes('required')) {
        return new ApiError({
          code: 'BAD_REQUEST',
          message: 'Bad request',
          detail: msg,
          instance: context?.path,
          requestId: context?.requestId,
          correlationId: context?.correlationId,
          cause: error,
        });
      }

      // Generic internal error fallback
      return new ApiError({
        code: 'INTERNAL_ERROR',
        message: 'An internal error occurred',
        detail: 'An unexpected internal error occurred while processing the request.',
        instance: context?.path,
        requestId: context?.requestId,
        correlationId: context?.correlationId,
        cause: error,
      });
    }

    return new ApiError({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      detail: String(error),
      instance: context?.path,
      requestId: context?.requestId,
      correlationId: context?.correlationId,
    });
  }
}
