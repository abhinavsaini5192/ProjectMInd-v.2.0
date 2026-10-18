import { ContextOrchestrationError } from './ContextOrchestrationError.js';

export class ContextRetrievalError extends ContextOrchestrationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONTEXT_RETRIEVAL_ERROR', details);
    this.name = 'ContextRetrievalError';
  }
}
