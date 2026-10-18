export type AgentProtocol =
  | 'CANONICAL'
  | 'MCP'
  | 'HTTP'
  | 'WEBSOCKET'
  | 'CLI'
  | 'IDE'
  | 'CUSTOM';

export const AGENT_PROTOCOLS: readonly AgentProtocol[] = [
  'CANONICAL',
  'MCP',
  'HTTP',
  'WEBSOCKET',
  'CLI',
  'IDE',
  'CUSTOM',
] as const;

export function isAgentProtocol(value: unknown): value is AgentProtocol {
  return typeof value === 'string' && AGENT_PROTOCOLS.includes(value as AgentProtocol);
}
