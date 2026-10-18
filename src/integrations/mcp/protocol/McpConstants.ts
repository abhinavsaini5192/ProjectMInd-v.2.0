export const McpConstants = {
  PROTOCOL_VERSION: '2024-11-05',
  DEFAULT_SERVER_NAME: 'projectmind-mcp-server',
  DEFAULT_SERVER_VERSION: '1.0.0',
  DEFAULT_MAX_PAYLOAD_BYTES: 512 * 1024,
  DEFAULT_REQUEST_TIMEOUT_MS: 15000,
  DEFAULT_SESSION_TIMEOUT_MS: 30 * 60 * 1000,

  // Methods
  METHOD_INITIALIZE: 'initialize',
  METHOD_TOOLS_LIST: 'tools/list',
  METHOD_TOOLS_CALL: 'tools/call',
  METHOD_PING: 'ping',
} as const;
