import { AgentError } from './AgentError.js';

export class AgentValidationError extends AgentError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'AGENT_VALIDATION_ERROR', details);
    this.name = 'AgentValidationError';
  }
}
