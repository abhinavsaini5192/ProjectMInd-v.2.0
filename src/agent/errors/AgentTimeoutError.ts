import { AgentError } from './AgentError.js';

export class AgentTimeoutError extends AgentError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'AGENT_TIMEOUT', details);
    this.name = 'AgentTimeoutError';
  }
}
