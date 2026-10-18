export interface SecurityErrorDetails {
  readonly code?: string | undefined;
  readonly statusCode?: number | undefined;
  readonly principalId?: string | undefined;
  readonly scope?: Record<string, unknown> | undefined;
  readonly action?: string | undefined;
  readonly resourceType?: string | undefined;
  readonly context?: Record<string, unknown> | undefined;
}

export class SecurityError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details: SecurityErrorDetails;

  constructor(message: string, details: SecurityErrorDetails = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = details.code ?? 'SECURITY_ERROR';
    this.statusCode = details.statusCode ?? 403;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends SecurityError {
  constructor(message: string = 'Authentication failed', details: SecurityErrorDetails = {}) {
    super(message, {
      ...details,
      code: details.code ?? 'AUTHENTICATION_FAILED',
      statusCode: details.statusCode ?? 401,
    });
  }
}

export class InvalidCredentialError extends AuthenticationError {
  constructor(message: string = 'Invalid credential provided', details: SecurityErrorDetails = {}) {
    super(message, {
      ...details,
      code: details.code ?? 'INVALID_CREDENTIAL',
      statusCode: 401,
    });
  }
}

export class AuthorizationError extends SecurityError {
  constructor(message: string = 'Access denied', details: SecurityErrorDetails = {}) {
    super(message, {
      ...details,
      code: details.code ?? 'AUTHORIZATION_DENIED',
      statusCode: details.statusCode ?? 403,
    });
  }
}

export class PermissionDeniedError extends AuthorizationError {
  constructor(message: string = 'Permission denied', details: SecurityErrorDetails = {}) {
    super(message, {
      ...details,
      code: details.code ?? 'PERMISSION_DENIED',
      statusCode: 403,
    });
  }
}

export class ScopeViolationError extends AuthorizationError {
  constructor(message: string = 'Resource scope violation', details: SecurityErrorDetails = {}) {
    super(message, {
      ...details,
      code: details.code ?? 'SCOPE_VIOLATION',
      statusCode: 403,
    });
  }
}

export class IdentityNotFoundError extends SecurityError {
  constructor(message: string = 'Identity not found', details: SecurityErrorDetails = {}) {
    super(message, {
      ...details,
      code: details.code ?? 'IDENTITY_NOT_FOUND',
      statusCode: 404,
    });
  }
}

export class SecurityPolicyError extends SecurityError {
  constructor(message: string = 'Security policy violation', details: SecurityErrorDetails = {}) {
    super(message, {
      ...details,
      code: details.code ?? 'SECURITY_POLICY_VIOLATION',
      statusCode: 403,
    });
  }
}
