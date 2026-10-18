import { ToolError } from './ToolError.js';

export class ToolArgumentError extends ToolError {
  constructor(message: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(message, 'TOOL_ARGUMENT_INVALID', false, details, requestId);
    this.name = 'ToolArgumentError';
  }
}
