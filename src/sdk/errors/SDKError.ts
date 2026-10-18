export class SDKError extends Error {
  public readonly code: string;
  public readonly statusCode?: number | undefined;
  public readonly correlationId?: string | undefined;

  constructor(
    message: string,
    code: string = 'SDK_ERROR',
    statusCode?: number,
    correlationId?: string
  ) {
    super(message);
    this.name = 'SDKError';
    this.code = code;
    this.statusCode = statusCode;
    this.correlationId = correlationId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends SDKError {
  constructor(message: string = 'Authentication failed. Check your API key or token.', correlationId?: string) {
    super(message, 'AUTHENTICATION_ERROR', 401, correlationId);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends SDKError {
  public readonly retryAfterMs?: number | undefined;

  constructor(message: string = 'Rate limit exceeded.', retryAfterMs?: number, correlationId?: string) {
    super(message, 'RATE_LIMIT_ERROR', 429, correlationId);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class TimeoutError extends SDKError {
  public readonly timeoutMs: number;

  constructor(timeoutMs: number, correlationId?: string) {
    super(`Request timed out after ${timeoutMs}ms.`, 'TIMEOUT_ERROR', 408, correlationId);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

export class NotFoundError extends SDKError {
  constructor(resource: string, correlationId?: string) {
    super(`Resource '${resource}' not found.`, 'NOT_FOUND_ERROR', 404, correlationId);
    this.name = 'NotFoundError';
  }
}

export class SecurityError extends SDKError {
  constructor(message: string, correlationId?: string) {
    super(message, 'SECURITY_ERROR', 403, correlationId);
    this.name = 'SecurityError';
  }
}

export class ValidationError extends SDKError {
  public readonly validationErrors: readonly string[];

  constructor(message: string, validationErrors: readonly string[] = [], correlationId?: string) {
    super(message, 'VALIDATION_ERROR', 400, correlationId);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}
