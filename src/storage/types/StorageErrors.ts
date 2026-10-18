import { ProjectMindError } from '../../workspace/errors';

export class StorageCoreError extends ProjectMindError {
  constructor(message: string, code: string = 'ERR_STORAGE_CORE', details?: Record<string, any>) {
    super(message, code, details);
  }
}

export class ProviderRegistrationError extends StorageCoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_PROVIDER_REGISTRATION', details);
  }
}

export class ProviderResolutionError extends StorageCoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_PROVIDER_RESOLUTION', details);
  }
}

export class StorageLifecycleError extends StorageCoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_STORAGE_LIFECYCLE', details);
  }
}

export class StorageValidationError extends StorageCoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_STORAGE_VALIDATION', details);
  }
}
