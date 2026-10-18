export class ToolError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'TOOL_ERROR',
    public readonly retryable: boolean = false,
    public readonly details?: Record<string, any> | undefined,
    public readonly requestId?: string | undefined
  ) {
    super(message);
    this.name = 'ToolError';
  }

  public toJSON(): Record<string, any> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.details !== undefined ? { details: this.details } : {}),
      ...(this.requestId !== undefined ? { requestId: this.requestId } : {}),
    };
  }
}
