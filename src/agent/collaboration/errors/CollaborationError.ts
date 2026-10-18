export class CollaborationError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, unknown> | undefined;

  constructor(
    message: string,
    code: string = 'COLLABORATION_ERROR',
    details?: Record<string, unknown> | undefined
  ) {
    super(message);
    this.name = 'CollaborationError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CollaborationNotFoundError extends CollaborationError {
  constructor(message: string, details?: Record<string, unknown> | undefined) {
    super(message, 'COLLABORATION_NOT_FOUND', details);
    this.name = 'CollaborationNotFoundError';
  }
}

export class CollaborationConflictError extends CollaborationError {
  constructor(message: string, details?: Record<string, unknown> | undefined) {
    super(message, 'COLLABORATION_CONFLICT', details);
    this.name = 'CollaborationConflictError';
  }
}

export class CollaborationSecurityError extends CollaborationError {
  constructor(message: string, details?: Record<string, unknown> | undefined) {
    super(message, 'COLLABORATION_SECURITY_VIOLATION', details);
    this.name = 'CollaborationSecurityError';
  }
}
