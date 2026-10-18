import { AgentError } from './AgentError.js';

export class AgentCapabilityError extends AgentError {
  constructor(
    message: string,
    public readonly requiredCapabilities: string[] = [],
    details?: Record<string, any> | undefined
  ) {
    super(message, 'AGENT_UNSUPPORTED_CAPABILITY', { requiredCapabilities, ...details });
    this.name = 'AgentCapabilityError';
  }
}
