import { ProjectMindError } from '../../errors/index.js';

export type PlatformErrorCode =
  | 'CONFIGURATION_ERROR'
  | 'INITIALIZATION_ERROR'
  | 'DEPENDENCY_ERROR'
  | 'VALIDATION_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'CONFLICT'
  | 'TIMEOUT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

export interface PlatformErrorOptions {
  readonly code: PlatformErrorCode;
  readonly statusCode?: number | undefined;
  readonly correlationId?: string | undefined;
  readonly requestId?: string | undefined;
  readonly suggestedRecovery?: string | undefined;
  readonly details?: Record<string, unknown> | undefined;
  readonly cause?: unknown | undefined;
}

export class PlatformError extends ProjectMindError {
  public readonly statusCode: number;
  public readonly correlationId?: string | undefined;
  public readonly requestId?: string | undefined;
  public readonly details?: Record<string, unknown> | undefined;

  constructor(message: string, options: PlatformErrorOptions) {
    super(message, options.code, options.suggestedRecovery);
    this.name = 'PlatformError';
    this.statusCode = options.statusCode ?? this.resolveDefaultStatusCode(options.code);
    this.correlationId = options.correlationId;
    this.requestId = options.requestId;
    this.details = options.details;
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  private resolveDefaultStatusCode(code: PlatformErrorCode): number {
    switch (code) {
      case 'CONFIGURATION_ERROR':
      case 'INITIALIZATION_ERROR':
        return 500;
      case 'DEPENDENCY_ERROR':
      case 'SERVICE_UNAVAILABLE':
        return 503;
      case 'VALIDATION_ERROR':
        return 400;
      case 'RESOURCE_NOT_FOUND':
        return 404;
      case 'CONFLICT':
        return 409;
      case 'TIMEOUT':
        return 504;
      case 'RATE_LIMITED':
        return 429;
      case 'INTERNAL_ERROR':
      default:
        return 500;
    }
  }
}
