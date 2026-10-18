import type { AgentType } from './AgentType.js';
import type { AgentStatus } from './AgentStatus.js';
import type { AgentTrustLevel } from './AgentTrustLevel.js';
import type { AgentCapabilitySet } from './AgentCapabilitySet.js';

/**
 * Registered Agent model in ProjectMind.
 */
export interface Agent {
  readonly agentId: string;
  readonly name: string;
  readonly type: AgentType;
  readonly version: string;
  readonly vendor?: string | undefined;
  readonly description?: string | undefined;
  readonly capabilities: AgentCapabilitySet;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly status: AgentStatus;
  readonly trustLevel: AgentTrustLevel;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Parameters to register or update an Agent.
 */
export interface AgentRegistrationParams {
  readonly agentId: string;
  readonly name: string;
  readonly type: AgentType;
  readonly version: string;
  readonly vendor?: string | undefined;
  readonly description?: string | undefined;
  readonly capabilities?: AgentCapabilitySet | string[] | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
  readonly trustLevel?: AgentTrustLevel | undefined;
}
