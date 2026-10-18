import { ToolError } from './ToolError.js';

export class ToolNotFoundError extends ToolError {
  constructor(toolName: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(`Tool '${toolName}' not found in registry.`, 'TOOL_NOT_FOUND', false, { toolName, ...details }, requestId);
    this.name = 'ToolNotFoundError';
  }
}
