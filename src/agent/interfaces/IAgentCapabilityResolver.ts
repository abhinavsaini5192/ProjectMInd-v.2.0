import type { Agent } from '../models/Agent.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import type { AgentCapabilitySet } from '../models/AgentCapabilitySet.js';
import type { AgentOperationType } from '../models/AgentOperation.js';

export interface IAgentCapabilityResolver {
  resolveEffectiveCapabilities(
    agent: Agent,
    requested?: AgentCapabilitySet | string[] | undefined
  ): AgentCapabilitySet;

  assertCanPerform(
    agent: Agent,
    session: AgentSession | undefined,
    operation: AgentOperationType,
    requiredCapabilities: readonly AgentCapability[]
  ): void;
}
