import { AgentError } from './AgentError.js';

export class AgentScopeError extends AgentError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'AGENT_SCOPE_VIOLATION', details);
    this.name = 'AgentScopeError';
  }
}
