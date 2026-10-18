export type AgentStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'DEREGISTERED';

export const AGENT_STATUSES: readonly AgentStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'SUSPENDED',
  'DEREGISTERED',
] as const;

export function isAgentStatus(value: unknown): value is AgentStatus {
  return typeof value === 'string' && AGENT_STATUSES.includes(value as AgentStatus);
}
