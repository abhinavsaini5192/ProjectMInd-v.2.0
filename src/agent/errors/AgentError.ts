export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'AGENT_ERROR',
    public readonly details?: Record<string, any> | undefined
  ) {
    super(message);
    this.name = 'AgentError';
  }

  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}
