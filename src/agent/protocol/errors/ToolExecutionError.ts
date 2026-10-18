import { ToolError } from './ToolError.js';

export class ToolExecutionError extends ToolError {
  constructor(message: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(message, 'TOOL_EXECUTION_FAILED', true, details, requestId);
    this.name = 'ToolExecutionError';
  }
}
