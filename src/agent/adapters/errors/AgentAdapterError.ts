export class AgentAdapterError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, code = 'AGENT_ADAPTER_ERROR', details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AgentAdapterNotFoundError extends AgentAdapterError {
  constructor(identifier: string, details?: unknown) {
    super(`Agent adapter not found for identifier or criteria: '${identifier}'`, 'ADAPTER_NOT_FOUND', details);
  }
}

export class UnsupportedAgentProtocolError extends AgentAdapterError {
  constructor(protocol: string, version?: string, details?: unknown) {
    super(
      `Agent protocol '${protocol}'${version ? ` (version ${version})` : ''} is not supported by this adapter.`,
      'UNSUPPORTED_AGENT_PROTOCOL',
      details
    );
  }
}

export class UnsupportedCapabilityError extends AgentAdapterError {
  constructor(capability: string, adapterId: string, details?: unknown) {
    super(
      `Capability '${capability}' is not supported by adapter '${adapterId}'.`,
      'UNSUPPORTED_CAPABILITY',
      details
    );
  }
}

export class AdapterValidationError extends AgentAdapterError {
  public readonly adapterId?: string | undefined;

  constructor(message: string, details?: unknown, adapterId?: string);
  constructor(adapterId: string, message: string, details?: unknown);
  constructor(arg1: string, arg2?: unknown, arg3?: unknown) {
    if (typeof arg2 === 'string') {
      super(arg2, 'ADAPTER_VALIDATION_ERROR', arg3);
      this.adapterId = arg1;
    } else {
      super(arg1, 'ADAPTER_VALIDATION_ERROR', arg2);
      this.adapterId = typeof arg3 === 'string' ? arg3 : undefined;
    }
  }
}

export class AdapterVersionIncompatibleError extends AgentAdapterError {
  constructor(adapterId: string, supported: string, requested: string, details?: unknown) {
    super(
      `Protocol version '${requested}' is incompatible with adapter '${adapterId}' (supported: '${supported}').`,
      'ADAPTER_VERSION_INCOMPATIBLE',
      details
    );
  }
}

export class AdapterTranslationError extends AgentAdapterError {
  public readonly adapterId?: string | undefined;

  constructor(message: string, details?: unknown, adapterId?: string);
  constructor(adapterId: string, message: string, details?: unknown);
  constructor(arg1: string, arg2?: unknown, arg3?: unknown) {
    if (typeof arg2 === 'string') {
      super(arg2, 'ADAPTER_TRANSLATION_ERROR', arg3);
      this.adapterId = arg1;
    } else {
      super(arg1, 'ADAPTER_TRANSLATION_ERROR', arg2);
      this.adapterId = typeof arg3 === 'string' ? arg3 : undefined;
    }
  }
}
