import { ToolError } from './ToolError.js';

export class ToolStaleDataError extends ToolError {
  constructor(message: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(message, 'TOOL_STALE_DATA', true, details, requestId);
    this.name = 'ToolStaleDataError';
  }
}
