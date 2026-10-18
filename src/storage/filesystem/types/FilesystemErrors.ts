import { ProjectMindError } from '../../../workspace/errors';

export class FilesystemCoreError extends ProjectMindError {
  constructor(message: string, code: string = 'ERR_FILESYSTEM_CORE', details?: Record<string, any>) {
    super(message, code, details);
  }
}

export class LockTimeoutError extends FilesystemCoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_LOCK_TIMEOUT', details);
  }
}

export class PermissionDeniedError extends FilesystemCoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_PERMISSION_DENIED', details);
  }
}

export class PointerFileError extends FilesystemCoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_POINTER_FILE', details);
  }
}

export class DirectoryOperationError extends FilesystemCoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_DIR_OPERATION', details);
  }
}

export class FileOperationError extends FilesystemCoreError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'ERR_FILE_OPERATION', details);
  }
}
