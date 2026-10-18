export class ObservationError extends Error {
  constructor(message: string, public readonly code: string = 'OBSERVATION_ERROR') {
    super(message);
    this.name = 'ObservationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ObservationValidationError extends ObservationError {
  constructor(message: string, public readonly validationErrors: readonly string[] = []) {
    super(message, 'OBSERVATION_VALIDATION_ERROR');
    this.name = 'ObservationValidationError';
  }
}

export class ObservationSecurityError extends ObservationError {
  constructor(message: string, public readonly securityViolation: string) {
    super(message, 'OBSERVATION_SECURITY_ERROR');
    this.name = 'ObservationSecurityError';
  }
}

export class ObservationScopeError extends ObservationSecurityError {
  constructor(message: string) {
    super(message, 'OBSERVATION_SCOPE_VIOLATION');
    this.name = 'ObservationScopeError';
  }
}

export class ObservationPayloadLimitError extends ObservationError {
  constructor(message: string, public readonly actualSize: number, public readonly limit: number) {
    super(message, 'OBSERVATION_PAYLOAD_LIMIT_ERROR');
    this.name = 'ObservationPayloadLimitError';
  }
}

export class ObservationNotFoundError extends ObservationError {
  constructor(public readonly observationId: string) {
    super(`Observation '${observationId}' not found.`, 'OBSERVATION_NOT_FOUND_ERROR');
    this.name = 'ObservationNotFoundError';
  }
}

export class ObservationConflictError extends ObservationError {
  constructor(message: string, public readonly conflictId: string) {
    super(message, 'OBSERVATION_CONFLICT_ERROR');
    this.name = 'ObservationConflictError';
  }
}

export class ObservationProcessingError extends ObservationError {
  constructor(message: string, public readonly causeError?: unknown) {
    super(message, 'OBSERVATION_PROCESSING_ERROR');
    this.name = 'ObservationProcessingError';
  }
}
