import { AgentError } from './AgentError.js';

export class AgentVersionError extends AgentError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'AGENT_VERSION_MISMATCH', details);
    this.name = 'AgentVersionError';
  }
}
