import { AgentError } from './AgentError.js';

export class AgentProtocolError extends AgentError {
  constructor(message: string, details?: Record<string, any> | undefined) {
    super(message, 'AGENT_PROTOCOL_ERROR', details);
    this.name = 'AgentProtocolError';
  }
}
