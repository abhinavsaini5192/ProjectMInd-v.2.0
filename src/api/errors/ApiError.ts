import { API_ERROR_STATUS_MAP, type ApiErrorCode } from './ApiErrorCode.js';

export interface FieldValidationError {
  readonly field: string;
  readonly message: string;
  readonly value?: unknown;
}

export interface ApiErrorPayload {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly code: ApiErrorCode;
  readonly instance?: string | undefined;
  readonly errors?: readonly FieldValidationError[] | undefined;
  readonly requestId?: string | undefined;
  readonly correlationId?: string | undefined;
}

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly detail: string;
  public readonly type: string;
  public readonly instance?: string | undefined;
  public readonly errors?: readonly FieldValidationError[] | undefined;
  public readonly requestId?: string | undefined;
  public readonly correlationId?: string | undefined;
  public readonly retryAfter?: number | undefined;

  constructor(options: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly detail?: string | undefined;
    readonly status?: number | undefined;
    readonly instance?: string | undefined;
    readonly errors?: readonly FieldValidationError[] | undefined;
    readonly requestId?: string | undefined;
    readonly correlationId?: string | undefined;
    readonly retryAfter?: number | undefined;
    readonly cause?: unknown;
  }) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status ?? API_ERROR_STATUS_MAP[options.code] ?? 500;
    this.detail = options.detail ?? options.message;
    this.type = `urn:projectmind:error:${options.code.toLowerCase()}`;
    this.instance = options.instance;
    this.errors = options.errors;
    this.requestId = options.requestId;
    this.correlationId = options.correlationId;
    this.retryAfter = options.retryAfter;

    if (options.cause) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public toJSON(): ApiErrorPayload {
    return {
      type: this.type,
      title: this.message,
      status: this.status,
      detail: this.detail,
      code: this.code,
      instance: this.instance,
      errors: this.errors,
      requestId: this.requestId,
      correlationId: this.correlationId,
    };
  }

  public static badRequest(message: string, detail?: string, errors?: FieldValidationError[]): ApiError {
    return new ApiError({ code: 'BAD_REQUEST', message, detail, errors });
  }

  public static unauthenticated(message: string = 'Authentication required'): ApiError {
    return new ApiError({ code: 'UNAUTHENTICATED', message });
  }

  public static forbidden(message: string = 'Permission denied'): ApiError {
    return new ApiError({ code: 'FORBIDDEN', message });
  }

  public static invalidScope(message: string = 'Resource scope denied or mismatched'): ApiError {
    return new ApiError({ code: 'INVALID_SCOPE', message });
  }

  public static notFound(message: string = 'Resource not found'): ApiError {
    return new ApiError({ code: 'NOT_FOUND', message });
  }

  public static methodNotAllowed(method: string): ApiError {
    return new ApiError({ code: 'METHOD_NOT_ALLOWED', message: `Method ${method} not allowed` });
  }

  public static conflict(message: string): ApiError {
    return new ApiError({ code: 'CONFLICT', message });
  }

  public static idempotencyConflict(message: string): ApiError {
    return new ApiError({ code: 'IDEMPOTENCY_CONFLICT', message });
  }

  public static rateLimited(message: string = 'Too many requests', retryAfter?: number): ApiError {
    return new ApiError({ code: 'RATE_LIMITED', message, retryAfter });
  }

  public static internal(message: string = 'Internal server error', detail?: string): ApiError {
    return new ApiError({ code: 'INTERNAL_ERROR', message, detail });
  }

  public static unsupportedVersion(version: string): ApiError {
    return new ApiError({ code: 'UNSUPPORTED_VERSION', message: `API version '${version}' is not supported` });
  }

  public static notImplemented(message: string = 'Not implemented'): ApiError {
    return new ApiError({ code: 'NOT_IMPLEMENTED', message });
  }
}
