export type McpServerState =
  | 'STOPPED'
  | 'STARTING'
  | 'RUNNING'
  | 'DRAINING'
  | 'STOPPING'
  | 'FAILED';

export const MCP_SERVER_STATES: readonly McpServerState[] = [
  'STOPPED',
  'STARTING',
  'RUNNING',
  'DRAINING',
  'STOPPING',
  'FAILED',
] as const;
