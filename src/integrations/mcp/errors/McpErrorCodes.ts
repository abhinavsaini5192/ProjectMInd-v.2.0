/**
 * Standard JSON-RPC and MCP Error Codes
 */
export const McpErrorCodes = {
  // JSON-RPC 2.0 standard codes
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // MCP / ProjectMind specific application codes
  SESSION_INVALID: -32001,
  SESSION_EXPIRED: -32002,
  SCOPE_VIOLATION: -32003,
  PAYLOAD_TOO_LARGE: -32004,
  SERVER_DRAINING: -32005,
  TOOL_NOT_FOUND: -32006,
  RATE_LIMITED: -32007,
  TIMEOUT: -32008,
} as const;

export type McpErrorCode = typeof McpErrorCodes[keyof typeof McpErrorCodes];
