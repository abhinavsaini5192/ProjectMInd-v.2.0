import { ContextOrchestrationError } from './ContextOrchestrationError.js';

export class ContextPlanningError extends ContextOrchestrationError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'CONTEXT_PLANNING_ERROR', details);
    this.name = 'ContextPlanningError';
  }
}
