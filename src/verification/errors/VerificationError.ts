export abstract class VerificationError extends Error {
  public abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class VerificationValidationError extends VerificationError {
  public readonly code = 'VERIFICATION_VALIDATION_ERROR';

  constructor(
    message: string,
    public readonly validationErrors: readonly string[] = []
  ) {
    super(message);
  }
}

export class VerificationScopeError extends VerificationError {
  public readonly code = 'VERIFICATION_SCOPE_ERROR';

  constructor(
    message: string,
    public readonly expectedScope?: string | undefined,
    public readonly actualScope?: string | undefined
  ) {
    super(message);
  }
}

export class VerificationPayloadLimitError extends VerificationError {
  public readonly code = 'VERIFICATION_PAYLOAD_LIMIT_EXCEEDED';

  constructor(
    message: string,
    public readonly currentSizeBytes: number,
    public readonly maxAllowedBytes: number
  ) {
    super(message);
  }
}

export class VerificationSecurityError extends VerificationError {
  public readonly code = 'VERIFICATION_SECURITY_ERROR';

  constructor(
    message: string,
    public readonly reason: string = 'SECURITY_VIOLATION'
  ) {
    super(message);
  }
}

export class VerificationNotFoundError extends VerificationError {
  public readonly code = 'VERIFICATION_NOT_FOUND';

  constructor(
    message: string,
    public readonly verificationId?: string | undefined
  ) {
    super(message);
  }
}

export class VerificationConflictError extends VerificationError {
  public readonly code = 'VERIFICATION_CONFLICT';

  constructor(
    message: string,
    public readonly conflictId: string
  ) {
    super(message);
  }
}

export class VerificationTrustError extends VerificationError {
  public readonly code = 'VERIFICATION_TRUST_ERROR';

  constructor(
    message: string,
    public readonly attemptedLevel?: string | undefined
  ) {
    super(message);
  }
}
