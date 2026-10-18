import { ToolError } from './ToolError.js';

export class ToolResultError extends ToolError {
  constructor(message: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(message, 'TOOL_RESULT_INVALID', false, details, requestId);
    this.name = 'ToolResultError';
  }
}
