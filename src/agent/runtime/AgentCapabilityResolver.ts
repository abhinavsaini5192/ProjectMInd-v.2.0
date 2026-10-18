import type { Agent } from '../models/Agent.js';
import type { AgentSession } from '../models/AgentSession.js';
import type { AgentCapability } from '../models/AgentCapability.js';
import { AgentCapabilitySet } from '../models/AgentCapabilitySet.js';
import type { AgentOperationType } from '../models/AgentOperation.js';
import type { IAgentCapabilityResolver } from '../interfaces/IAgentCapabilityResolver.js';
import { AgentTrustModel } from '../architecture/AgentTrustModel.js';
import { AgentCapabilityError } from '../errors/AgentCapabilityError.js';

export class AgentCapabilityResolver implements IAgentCapabilityResolver {
  public resolveEffectiveCapabilities(
    agent: Agent,
    requested?: AgentCapabilitySet | string[] | undefined
  ): AgentCapabilitySet {
    if (!requested) {
      return agent.capabilities.clone();
    }

    const requestedSet =
      requested instanceof AgentCapabilitySet ? requested : new AgentCapabilitySet(requested);

    return agent.capabilities.intersection(requestedSet);
  }

  public assertCanPerform(
    agent: Agent,
    session: AgentSession | undefined,
    operation: AgentOperationType,
    requiredCapabilities: readonly AgentCapability[]
  ): void {
    // 1. Verify Trust Model boundary
    AgentTrustModel.assertAllowed(agent.trustLevel, operation, agent.agentId);

    // 2. Verify Agent Capabilities
    const missingAgentCaps: AgentCapability[] = [];
    for (const cap of requiredCapabilities) {
      if (!agent.capabilities.has(cap)) {
        missingAgentCaps.push(cap);
      }
    }

    if (missingAgentCaps.length > 0) {
      throw new AgentCapabilityError(
        `Agent '${agent.agentId}' lacks required capability for operation '${operation}': ${missingAgentCaps.join(', ')}`,
        missingAgentCaps,
        { agentId: agent.agentId }
      );
    }

    // 3. Verify Session Capabilities (if session is active)
    if (session) {
      const missingSessionCaps: AgentCapability[] = [];
      for (const cap of requiredCapabilities) {
        if (!session.capabilities.has(cap)) {
          missingSessionCaps.push(cap);
        }
      }

      if (missingSessionCaps.length > 0) {
        throw new AgentCapabilityError(
          `Session '${session.sessionId}' lacks required capability for operation '${operation}': ${missingSessionCaps.join(', ')}`,
          missingSessionCaps,
          { agentId: agent.agentId, sessionId: session.sessionId }
        );
      }
    }
  }
}
