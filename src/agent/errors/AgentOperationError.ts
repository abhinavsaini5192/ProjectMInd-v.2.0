import { AgentError } from './AgentError.js';

export class AgentOperationError extends AgentError {
  constructor(message: string, public readonly operation?: string, details?: Record<string, any> | undefined) {
    super(message, 'AGENT_OPERATION_ERROR', { operation, ...details });
    this.name = 'AgentOperationError';
  }
}
