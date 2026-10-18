import type { Identity } from './Identity.js';

export type SecurityTrustLevel = 'UNTRUSTED' | 'LIMITED' | 'STANDARD' | 'VERIFIED' | 'SYSTEM';

export const SECURITY_TRUST_LEVELS: readonly SecurityTrustLevel[] = [
  'UNTRUSTED',
  'LIMITED',
  'STANDARD',
  'VERIFIED',
  'SYSTEM',
] as const;

export const SECURITY_TRUST_LEVEL_RANKS: Record<SecurityTrustLevel, number> = {
  UNTRUSTED: 0,
  LIMITED: 1,
  STANDARD: 2,
  VERIFIED: 3,
  SYSTEM: 4,
};

export interface AgentIdentity extends Identity {
  readonly type: 'AGENT';
  readonly agentId: string;
  readonly adapterId?: string | undefined;
  readonly provider?: string | undefined;
  readonly protocol?: string | undefined;
  readonly capabilities: readonly string[];
  readonly trustLevel: SecurityTrustLevel;
}

export function isAgentIdentity(identity: Identity): identity is AgentIdentity {
  return identity.type === 'AGENT' && typeof (identity as AgentIdentity).agentId === 'string';
}
