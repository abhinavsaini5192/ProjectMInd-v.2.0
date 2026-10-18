import { SecuritySanitizer } from '../../../intelligence/agent/hardening/SecuritySanitizer.js';
import { ToolError } from '../../../agent/protocol/errors/ToolError.js';
import { McpError } from './McpError.js';
import { McpErrorCodes } from './McpErrorCodes.js';
import type { McpCallToolResult } from '../protocol/McpTypes.js';

export class McpErrorMapper {
  /**
   * Translates any error into a safe, sanitized MCP CallToolResult with isError: true.
   */
  public static toCallToolResult(error: unknown, fallbackRequestId?: string): McpCallToolResult {
    let errorCode = 'INTERNAL_ERROR';
    let rawMessage = 'An unexpected error occurred.';
    let requestId = fallbackRequestId;

    if (error instanceof ToolError) {
      errorCode = error.code || 'TOOL_ERROR';
      rawMessage = error.message;
      if (error.requestId) {
        requestId = error.requestId;
      }
    } else if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      const errObj = error as { code: string; message: string; requestId?: string };
      errorCode = String(errObj.code) || 'TOOL_ERROR';
      rawMessage = String(errObj.message);
      if (errObj.requestId) {
        requestId = errObj.requestId;
      }
    } else if (error instanceof McpError) {
      errorCode = String(error.code);
      rawMessage = error.message;
    } else if (error instanceof Error) {
      rawMessage = error.message;
    } else if (typeof error === 'string') {
      rawMessage = error;
    }

    const sanitizedMessage = SecuritySanitizer.redactSecrets(rawMessage);
    const reqPart = requestId ? ` (Request ID: ${requestId})` : '';
    const formattedText = `[Error ${errorCode}] ${sanitizedMessage}${reqPart}`;

    return {
      content: [
        {
          type: 'text',
          text: formattedText,
        },
      ],
      isError: true,
    };
  }

  /**
   * Maps an error to a JSON-RPC compliant error payload for protocol-level errors.
   */
  public static toJsonRpcError(error: unknown): { code: number; message: string; data?: unknown } {
    if (error instanceof McpError) {
      const sanitized = SecuritySanitizer.redactSecrets(error.message);
      return {
        code: typeof error.code === 'number' ? error.code : McpErrorCodes.INTERNAL_ERROR,
        message: sanitized,
        ...(error.data !== undefined ? { data: error.data } : {}),
      };
    }

    if (error instanceof ToolError) {
      const sanitized = SecuritySanitizer.redactSecrets(error.message);
      let rpcCode: number = McpErrorCodes.INTERNAL_ERROR;
      if (error.code === 'TOOL_NOT_FOUND') {
        rpcCode = McpErrorCodes.TOOL_NOT_FOUND;
      } else if (
        error.code === 'TOOL_ARGUMENT_INVALID' ||
        error.code === 'TOOL_ARGUMENT_ERROR' ||
        error.code === 'VALIDATION_FAILED'
      ) {
        rpcCode = McpErrorCodes.INVALID_PARAMS;
      } else if (error.code === 'TOOL_SCOPE_DENIED' || error.code === 'TOOL_SCOPE_ERROR') {
        rpcCode = McpErrorCodes.SCOPE_VIOLATION;
      } else if (error.code === 'TOOL_PAYLOAD_TOO_LARGE') {
        rpcCode = McpErrorCodes.PAYLOAD_TOO_LARGE;
      }
      return {
        code: rpcCode,
        message: sanitized,
        data: {
          code: error.code,
          retryable: error.retryable,
          requestId: error.requestId,
        },
      };
    }

    if (error instanceof Error) {
      const sanitized = SecuritySanitizer.redactSecrets(error.message);
      return {
        code: McpErrorCodes.INTERNAL_ERROR,
        message: sanitized,
      };
    }

    return {
      code: McpErrorCodes.INTERNAL_ERROR,
      message: 'Internal JSON-RPC error occurred.',
    };
  }
}
