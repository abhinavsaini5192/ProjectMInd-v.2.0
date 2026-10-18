export abstract class ProjectMindError extends Error {
  public readonly code: string;
  public readonly details?: Record<string, any>;
  public readonly timestamp: string;

  constructor(message: string, code: string, details?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

export class WorkspaceError extends ProjectMindError {
  constructor(message: string, codeOrDetails?: string | Record<string, any>, details?: Record<string, any>) {
    const code = typeof codeOrDetails === 'string' ? codeOrDetails : 'ERR_WORKSPACE';
    const finalDetails = typeof codeOrDetails === 'object' && codeOrDetails !== null ? codeOrDetails : details;
    super(message, code, finalDetails);
  }
}

export class WorkspaceNotFoundError extends WorkspaceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_WORKSPACE_NOT_FOUND', details);
  }
}

export class RegistryError extends WorkspaceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_REGISTRY', details);
  }
}

export class StorageError extends WorkspaceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_STORAGE', details);
  }
}

export class ConfigurationError extends WorkspaceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_CONFIGURATION', details);
  }
}

export class LifecycleError extends WorkspaceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_LIFECYCLE', details);
  }
}

export class DIError extends ProjectMindError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_DEPENDENCY_INJECTION', details);
  }
}

export class ValidationError extends WorkspaceError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_VALIDATION', details);
  }
}
