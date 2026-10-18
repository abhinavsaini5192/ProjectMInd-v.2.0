import { ToolError } from './ToolError.js';

export class ToolDisabledError extends ToolError {
  constructor(toolName: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(`Tool '${toolName}' is disabled.`, 'TOOL_DISABLED', false, { toolName, ...details }, requestId);
    this.name = 'ToolDisabledError';
  }
}
