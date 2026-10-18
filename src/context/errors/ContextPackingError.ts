import { ContextOrchestrationError } from './ContextOrchestrationError.js';

export class ContextPackingError extends ContextOrchestrationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONTEXT_PACKING_ERROR', details);
    this.name = 'ContextPackingError';
  }
}
