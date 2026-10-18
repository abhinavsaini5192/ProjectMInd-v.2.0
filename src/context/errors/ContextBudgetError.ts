import { ContextOrchestrationError } from './ContextOrchestrationError.js';

export class ContextBudgetError extends ContextOrchestrationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONTEXT_BUDGET_ERROR', details);
    this.name = 'ContextBudgetError';
  }
}
