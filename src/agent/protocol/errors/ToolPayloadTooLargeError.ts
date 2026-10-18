import { ToolError } from './ToolError.js';

export class ToolPayloadTooLargeError extends ToolError {
  constructor(message: string, details?: Record<string, any> | undefined, requestId?: string | undefined) {
    super(message, 'TOOL_PAYLOAD_TOO_LARGE', false, details, requestId);
    this.name = 'ToolPayloadTooLargeError';
  }
}
