import { AgentError } from './AgentError.js';

export class AgentSessionNotFoundError extends AgentError {
  constructor(sessionId: string, details?: Record<string, any> | undefined) {
    super(`Agent session '${sessionId}' not found.`, 'AGENT_SESSION_NOT_FOUND', { sessionId, ...details });
    this.name = 'AgentSessionNotFoundError';
  }
}
