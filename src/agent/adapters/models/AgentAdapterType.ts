export type AgentAdapterType =
  | 'REFERENCE'
  | 'MCP'
  | 'CLI'
  | 'IDE'
  | 'PROVIDER'
  | 'CUSTOM';

export const AGENT_ADAPTER_TYPES: readonly AgentAdapterType[] = [
  'REFERENCE',
  'MCP',
  'CLI',
  'IDE',
  'PROVIDER',
  'CUSTOM',
] as const;
