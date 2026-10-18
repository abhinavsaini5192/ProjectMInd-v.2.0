import { ToolError } from './ToolError.js';

export class ToolProtocolError extends ToolError {
  constructor(message: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(message, 'TOOL_PROTOCOL_ERROR', false, details, requestId);
    this.name = 'ToolProtocolError';
  }
}
