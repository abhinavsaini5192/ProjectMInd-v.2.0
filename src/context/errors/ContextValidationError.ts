import { ProjectMindError } from '../../errors/index.js';

export class ContextValidationError extends ProjectMindError {
  constructor(message: string, code: string = 'CONTEXT_VALIDATION_FAILED', details?: any) {
    super(message, code, details);
    this.name = 'ContextValidationError';
  }
}
