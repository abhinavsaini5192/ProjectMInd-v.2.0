export type AgentType =
  | 'CODING_AGENT'
  | 'IDE_AGENT'
  | 'CLI_AGENT'
  | 'EDITOR_AGENT'
  | 'AUTOMATION_AGENT'
  | 'CUSTOM_AGENT'
  | 'UNKNOWN';

export const AGENT_TYPES: readonly AgentType[] = [
  'CODING_AGENT',
  'IDE_AGENT',
  'CLI_AGENT',
  'EDITOR_AGENT',
  'AUTOMATION_AGENT',
  'CUSTOM_AGENT',
  'UNKNOWN',
] as const;

export function isAgentType(value: unknown): value is AgentType {
  return typeof value === 'string' && AGENT_TYPES.includes(value as AgentType);
}
