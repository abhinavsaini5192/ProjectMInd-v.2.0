import { AgentError } from './AgentError.js';

export class AgentConflictError extends AgentError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'AGENT_CONFLICT', details);
    this.name = 'AgentConflictError';
  }
}
