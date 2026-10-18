export type AgentProvider =
  | 'GENERIC'
  | 'ANTHROPIC'
  | 'OPENAI'
  | 'CURSOR'
  | 'WINDSURF'
  | 'CLAUDE_CODE'
  | 'AIDER'
  | 'COPILOT'
  | 'CUSTOM';

export const AGENT_PROVIDERS: readonly AgentProvider[] = [
  'GENERIC',
  'ANTHROPIC',
  'OPENAI',
  'CURSOR',
  'WINDSURF',
  'CLAUDE_CODE',
  'AIDER',
  'COPILOT',
  'CUSTOM',
] as const;

export function isAgentProvider(value: unknown): value is AgentProvider {
  return typeof value === 'string' && AGENT_PROVIDERS.includes(value as AgentProvider);
}
