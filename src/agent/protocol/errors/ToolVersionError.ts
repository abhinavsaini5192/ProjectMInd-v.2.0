import { ToolError } from './ToolError.js';

export class ToolVersionError extends ToolError {
  constructor(message: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(message, 'TOOL_VERSION_UNSUPPORTED', false, details, requestId);
    this.name = 'ToolVersionError';
  }
}
