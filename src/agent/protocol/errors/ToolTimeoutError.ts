import { ToolError } from './ToolError.js';

export class ToolTimeoutError extends ToolError {
  constructor(message: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(message, 'TOOL_TIMEOUT', true, details, requestId);
    this.name = 'ToolTimeoutError';
  }
}
