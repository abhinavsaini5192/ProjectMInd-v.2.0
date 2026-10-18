import { ToolError } from './ToolError.js';

export class ToolScopeError extends ToolError {
  constructor(message: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(message, 'TOOL_SCOPE_DENIED', false, details, requestId);
    this.name = 'ToolScopeError';
  }
}
