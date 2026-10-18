import { ToolError } from './ToolError.js';

export class ToolCapabilityError extends ToolError {
  constructor(message: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(message, 'TOOL_CAPABILITY_DENIED', false, details, requestId);
    this.name = 'ToolCapabilityError';
  }
}
