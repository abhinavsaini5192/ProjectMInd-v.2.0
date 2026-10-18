import type { McpErrorCode } from './McpErrorCodes.js';

/**
 * Base MCP error representing JSON-RPC or protocol level errors.
 */
export class McpError extends Error {
  constructor(
    message: string,
    public readonly code: number | McpErrorCode,
    public readonly data?: unknown | undefined
  ) {
    super(message);
    this.name = 'McpError';
  }

  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      ...(this.data !== undefined ? { data: this.data } : {}),
    };
  }
}
