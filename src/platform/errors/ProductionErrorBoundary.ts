import { PlatformError, type PlatformErrorCode } from './PlatformError.js';
import type { EnvironmentName } from '../config/PlatformConfig.js';
import { ConfigRedactor } from '../config/ConfigRedactor.js';

export interface ExternalErrorEnvelope {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId?: string | undefined;
    readonly correlationId?: string | undefined;
    readonly suggestedRecovery?: string | undefined;
    readonly details?: unknown | undefined;
    readonly stack?: string | undefined;
  };
}

export class ProductionErrorBoundary {
  constructor(private readonly env: EnvironmentName = 'development') {}

  public formatExternalResponse(
    error: unknown,
    context?: { requestId?: string | undefined; correlationId?: string | undefined }
  ): ExternalErrorEnvelope {
    let code: PlatformErrorCode | string = 'INTERNAL_ERROR';
    let message = 'An unexpected internal error occurred.';
    let suggestedRecovery: string | undefined;
    let details: unknown | undefined;
    let stack: string | undefined;

    if (error instanceof PlatformError) {
      code = error.code;
      message = error.message;
      suggestedRecovery = error.suggestedRecovery;
      details = error.details;
      stack = error.stack;
    } else if (error instanceof Error) {
      code = 'INTERNAL_ERROR';
      message = error.message;
      stack = error.stack;
    } else if (typeof error === 'string') {
      message = error;
    }

    // Sanitize message: strip file paths and database connection strings
    const sanitizedMessage = this.sanitizeMessage(message);

    // In production or test, strictly suppress internal stack traces and hidden reasoning
    if (this.env !== 'development') {
      stack = undefined;
      // Strip details that might contain database / auth metadata
      if (details) {
        details = ConfigRedactor.redact(details);
      }
    }

    return {
      error: {
        code,
        message: sanitizedMessage,
        requestId: context?.requestId,
        correlationId: context?.correlationId,
        suggestedRecovery,
        ...(details ? { details } : {}),
        ...(stack && this.env === 'development' ? { stack } : {}),
      },
    };
  }

  private sanitizeMessage(msg: string): string {
    // Redact credentials
    let sanitized = ConfigRedactor.redactString(msg);
    // Redact absolute Windows/Unix paths in production
    if (this.env === 'production') {
      sanitized = sanitized.replace(/([a-zA-Z]:\\[^:\n\r]+|\/[a-zA-Z0-9._-]+\/[^:\n\r]+)/g, '[INTERNAL_PATH]');
    }
    return sanitized;
  }
}
