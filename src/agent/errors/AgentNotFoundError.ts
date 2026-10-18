import { AgentError } from './AgentError.js';

export class AgentNotFoundError extends AgentError {
  constructor(agentId: string, details?: Record<string, any> | undefined) {
    super(`Agent '${agentId}' not found.`, 'AGENT_NOT_FOUND', { agentId, ...details });
    this.name = 'AgentNotFoundError';
  }
}
