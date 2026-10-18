import { ToolError } from './ToolError.js';

export class ToolUnavailableError extends ToolError {
  constructor(message: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(message, 'TOOL_UNAVAILABLE', true, details, requestId);
    this.name = 'ToolUnavailableError';
  }
}
