import { ContextOrchestrationError } from './ContextOrchestrationError.js';

export class ContextAdapterError extends ContextOrchestrationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONTEXT_ADAPTER_ERROR', details);
    this.name = 'ContextAdapterError';
  }
}
