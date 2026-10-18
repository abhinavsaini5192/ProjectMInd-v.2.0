import { CorrelationContext } from '../correlation/CorrelationContext.js';
import { defaultLogSanitizer } from '../logging/LogSanitizer.js';

export type ErrorClassification =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'DEPENDENCY_OUTAGE'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'CONCURRENCY_CONFLICT'
  | 'RETRYABLE_JOB_FAILURE'
  | 'PERMANENT_JOB_FAILURE'
  | 'EVENT_PROCESSING_FAILURE'
  | 'CONFIGURATION_ERROR'
  | 'INTERNAL_ERROR';

export const ErrorCategory = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DEPENDENCY_OUTAGE: 'DEPENDENCY_OUTAGE',
  TIMEOUT: 'TIMEOUT',
  RATE_LIMITED: 'RATE_LIMITED',
  CONCURRENCY_CONFLICT: 'CONCURRENCY_CONFLICT',
  RETRYABLE_JOB_FAILURE: 'RETRYABLE_JOB_FAILURE',
  PERMANENT_JOB_FAILURE: 'PERMANENT_JOB_FAILURE',
  EVENT_PROCESSING_FAILURE: 'EVENT_PROCESSING_FAILURE',
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export class StandardizedError extends Error {
  public readonly classification: ErrorClassification;
  public readonly category: ErrorClassification;
  public readonly isRetryable: boolean;
  public readonly httpStatus: number;
  public readonly clientMessage: string;
  public readonly clientSafeMessage: string;
  public readonly diagnosticMessage: string;
  public readonly diagnosticDetails: string;
  public readonly rootCause?: string | undefined;

  constructor(params: {
    category?: ErrorClassification;
    classification?: ErrorClassification;
    message: string;
    isRetryable?: boolean;
    httpStatus?: number;
    clientMessage?: string;
    diagnosticMessage?: string;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = 'StandardizedError';
    this.classification = params.classification ?? params.category ?? 'INTERNAL_ERROR';
    this.category = this.classification;
    this.isRetryable = params.isRetryable ?? false;
    this.httpStatus = params.httpStatus ?? 500;
    this.clientMessage = params.clientMessage ?? params.message;
    this.clientSafeMessage = this.clientMessage;
    this.diagnosticMessage = params.diagnosticMessage ?? params.message;
    this.diagnosticDetails = this.diagnosticMessage;
  }
}

export interface ClassifiedError {
  readonly classification: ErrorClassification;
  readonly category: ErrorClassification;
  readonly code: string;
  readonly httpStatus: number;
  readonly isRetryable: boolean;
  readonly clientMessage: string;
  readonly clientSafeMessage: string;
  readonly diagnosticMessage: string;
  readonly diagnosticDetails: string;
  readonly rootCause?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly cause?: unknown | undefined;
  readonly stack?: string | undefined;
}

export class ErrorClassifier {
  /**
   * Maps an unknown error or exception to a standardized ClassifiedError.
   * Preserves root cause and stack while separating safe client messages from diagnostic detail.
   */
  public static classify(err: unknown, fallback?: ErrorClassification): ClassifiedError {
    const ambient = CorrelationContext.current();
    const correlationId = ambient?.correlationId;

    if (!err) {
      return {
        classification: fallback ?? 'INTERNAL_ERROR',
        category: fallback ?? 'INTERNAL_ERROR',
        code: 'UNKNOWN_ERROR',
        httpStatus: 500,
        isRetryable: false,
        clientMessage: 'An unknown server error occurred.',
        clientSafeMessage: 'An unknown server error occurred.',
        diagnosticMessage: 'ErrorClassifier received null or undefined error',
        diagnosticDetails: 'ErrorClassifier received null or undefined error',
        correlationId,
      };
    }

    const rawMessage = err instanceof Error ? err.message : String(err);
    const rawStack = err instanceof Error ? err.stack : undefined;
    const sanitizedMsg = defaultLogSanitizer.sanitizeString(rawMessage);
    const sanitizedStack = rawStack ? defaultLogSanitizer.sanitizeString(rawStack) : undefined;

    // Check specific known error objects or properties
    const anyErr = err as any;
    const code = anyErr.code ?? anyErr.errorCode ?? (err instanceof Error ? err.name : 'ERROR');
    const rootCause = anyErr.cause
      ? (anyErr.cause instanceof Error ? anyErr.cause.message : String(anyErr.cause))
      : undefined;

    const buildResult = (
      classification: ErrorClassification,
      resCode: string,
      httpStatus: number,
      isRetryable: boolean,
      clientMessage: string,
      diagnosticMessage: string = sanitizedMsg
    ): ClassifiedError => ({
      classification,
      category: classification,
      code: resCode,
      httpStatus,
      isRetryable,
      clientMessage,
      clientSafeMessage: clientMessage,
      diagnosticMessage,
      diagnosticDetails: diagnosticMessage,
      rootCause,
      correlationId,
      cause: err,
      stack: sanitizedStack,
    });

    if (err instanceof StandardizedError) {
      return buildResult(
        err.classification,
        err.name,
        err.httpStatus,
        err.isRetryable,
        err.clientMessage,
        err.diagnosticMessage
      );
    }

    // 1. Authentication Errors
    if (
      code === 'UNAUTHORIZED' ||
      code === 'AuthenticationError' ||
      code === 'AUTHENTICATION_REQUIRED' ||
      rawMessage.toLowerCase().includes('unauthorized') ||
      rawMessage.toLowerCase().includes('authentication') ||
      anyErr.statusCode === 401
    ) {
      return buildResult(
        'AUTHENTICATION_ERROR',
        'UNAUTHORIZED',
        401,
        false,
        'Authentication required or invalid credentials.'
      );
    }

    // 2. Authorization Errors
    if (
      code === 'FORBIDDEN' ||
      code === 'ForbiddenError' ||
      code === 'ACCESS_DENIED' ||
      rawMessage.toLowerCase().includes('permission') ||
      rawMessage.toLowerCase().includes('forbidden') ||
      anyErr.statusCode === 403
    ) {
      return buildResult(
        'AUTHORIZATION_ERROR',
        'FORBIDDEN',
        403,
        false,
        'You do not have permission to perform this action.'
      );
    }

    // 3. Validation Errors
    if (
      code === 'VALIDATION_ERROR' ||
      code === 'ValidationError' ||
      code === 'INVALID_USAGE' ||
      code === 'ZodError' ||
      rawMessage.toLowerCase().includes('validation') ||
      rawMessage.toLowerCase().includes('invalid') ||
      anyErr.statusCode === 400
    ) {
      return buildResult('VALIDATION_ERROR', String(code), 400, false, sanitizedMsg);
    }

    // 4. Resource Not Found
    if (
      code === 'NOT_FOUND' ||
      code === 'NotFoundError' ||
      anyErr.statusCode === 404 ||
      rawMessage.toLowerCase().includes('not found')
    ) {
      return buildResult(
        'RESOURCE_NOT_FOUND',
        'NOT_FOUND',
        404,
        false,
        'The requested resource was not found.'
      );
    }

    // 5. Rate Limiting
    if (
      code === 'RATE_LIMITED' ||
      code === 'RateLimitError' ||
      anyErr.statusCode === 429 ||
      rawMessage.toLowerCase().includes('rate limit') ||
      rawMessage.toLowerCase().includes('too many requests')
    ) {
      return buildResult(
        'RATE_LIMITED',
        'TOO_MANY_REQUESTS',
        429,
        true,
        'Too many requests. Please retry after some time.'
      );
    }

    // 6. Timeouts
    if (
      code === 'ETIMEDOUT' ||
      code === 'TIMEOUT' ||
      code === 'TimeoutError' ||
      code === 'JOB_TIMEOUT' ||
      rawMessage.toLowerCase().includes('timed out') ||
      rawMessage.toLowerCase().includes('timeout') ||
      anyErr.statusCode === 504
    ) {
      return buildResult(
        'TIMEOUT',
        'OPERATION_TIMEOUT',
        504,
        true,
        'The operation timed out. Please retry.'
      );
    }

    // 7. Concurrency and Locking Conflicts
    if (
      code === 'SQLITE_BUSY' ||
      code === 'CONCURRENCY_CONFLICT' ||
      code === 'LOCK_ACQUISITION_FAILED' ||
      code === 'LockAcquisitionError' ||
      code === 'FENCING_TOKEN_STALE' ||
      code === 'VERSION_CONFLICT' ||
      rawMessage.toLowerCase().includes('conflict') ||
      rawMessage.toLowerCase().includes('lock') ||
      rawMessage.toLowerCase().includes('sqlite busy') ||
      anyErr.statusCode === 409
    ) {
      return buildResult(
        'CONCURRENCY_CONFLICT',
        'CONFLICT',
        409,
        true,
        'A concurrent operation conflict occurred. Please retry.'
      );
    }

    // 8. Dependency Outages (Database, Redis, Network)
    if (
      code === 'ECONNREFUSED' ||
      code === 'ENOTFOUND' ||
      code === 'DATABASE_ERROR' ||
      code === 'SQLITE_CORRUPT' ||
      code === 'REDIS_CONNECTION_ERROR' ||
      rawMessage.toLowerCase().includes('connection refused') ||
      rawMessage.toLowerCase().includes('econnrefused') ||
      rawMessage.toLowerCase().includes('unreachable') ||
      anyErr.statusCode === 503
    ) {
      return buildResult(
        'DEPENDENCY_OUTAGE',
        'SERVICE_UNAVAILABLE',
        503,
        true,
        'An external service or database dependency is temporarily unavailable.'
      );
    }

    // 9. Configuration Errors
    if (
      code === 'CONFIG_ERROR' ||
      code === 'CONFIGURATION_ERROR' ||
      code === 'INITIALIZATION_ERROR' ||
      rawMessage.toLowerCase().includes('config')
    ) {
      return buildResult(
        'CONFIGURATION_ERROR',
        'CONFIGURATION_ERROR',
        500,
        false,
        'A platform configuration error occurred.'
      );
    }

    // Default: Internal Application Error
    return buildResult(
      fallback ?? 'INTERNAL_ERROR',
      String(code || 'INTERNAL_ERROR'),
      500,
      false,
      'An internal server error occurred.'
    );
  }
}
