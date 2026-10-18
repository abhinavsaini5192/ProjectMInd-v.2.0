export type AgentTrustLevel = 'UNTRUSTED' | 'LIMITED' | 'TRUSTED' | 'SYSTEM';

export const AGENT_TRUST_LEVELS: readonly AgentTrustLevel[] = [
  'UNTRUSTED',
  'LIMITED',
  'TRUSTED',
  'SYSTEM',
] as const;

export const AGENT_TRUST_LEVEL_RANKS: Record<AgentTrustLevel, number> = {
  UNTRUSTED: 0,
  LIMITED: 1,
  TRUSTED: 2,
  SYSTEM: 3,
};

export function isAgentTrustLevel(value: unknown): value is AgentTrustLevel {
  return typeof value === 'string' && AGENT_TRUST_LEVELS.includes(value as AgentTrustLevel);
}
