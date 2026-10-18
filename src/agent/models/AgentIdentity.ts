import type { AgentType } from './AgentType.js';

/**
 * Unique identification and metadata for an agent instance or provider.
 */
export interface AgentIdentity {
  readonly agentId: string;
  readonly name: string;
  readonly type: AgentType;
  readonly version: string;
  readonly vendor?: string | undefined;
  readonly description?: string | undefined;
}
