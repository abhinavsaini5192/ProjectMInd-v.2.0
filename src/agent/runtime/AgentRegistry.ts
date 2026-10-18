import type { Agent, AgentRegistrationParams } from '../models/Agent.js';
import type { AgentStatus } from '../models/AgentStatus.js';
import type { AgentTrustLevel } from '../models/AgentTrustLevel.js';
import { AgentCapabilitySet } from '../models/AgentCapabilitySet.js';
import type { IAgentRegistry } from '../interfaces/IAgentRegistry.js';
import { AgentConflictError } from '../errors/AgentConflictError.js';
import { AgentNotFoundError } from '../errors/AgentNotFoundError.js';
import { AgentValidationError } from '../errors/AgentValidationError.js';
import { AgentIntegrationEvents } from '../events/AgentIntegrationEvents.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';

export class AgentRegistry implements IAgentRegistry {
  private readonly agents = new Map<string, Agent>();

  constructor(private readonly eventBus?: IEventBus | undefined) {}

  public async register(params: AgentRegistrationParams): Promise<Agent> {
    if (!params.agentId || typeof params.agentId !== 'string' || params.agentId.trim() === '') {
      throw new AgentValidationError('agentId is required and must be a non-empty string');
    }
    if (!params.name || typeof params.name !== 'string' || params.name.trim() === '') {
      throw new AgentValidationError('name is required and must be a non-empty string');
    }
    if (!params.type) {
      throw new AgentValidationError('type is required');
    }
    if (!params.version || typeof params.version !== 'string') {
      throw new AgentValidationError('version is required');
    }

    const existing = this.agents.get(params.agentId);
    if (existing && existing.status !== 'DEREGISTERED') {
      throw new AgentConflictError(
        `Agent with ID '${params.agentId}' is already registered and active`,
        { agentId: params.agentId }
      );
    }

    const now = new Date().toISOString();
    const capabilities =
      params.capabilities instanceof AgentCapabilitySet
        ? params.capabilities
        : new AgentCapabilitySet(params.capabilities ?? []);

    const trustLevel: AgentTrustLevel = params.trustLevel ?? 'LIMITED';

    const agent: Agent = {
      agentId: params.agentId,
      name: params.name,
      type: params.type,
      version: params.version,
      vendor: params.vendor,
      description: params.description,
      capabilities,
      metadata: params.metadata,
      status: 'ACTIVE',
      trustLevel,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    this.agents.set(agent.agentId, agent);

    this.eventBus?.publish(AgentIntegrationEvents.AGENT_REGISTERED, {
      agent,
      timestamp: now,
    });

    return agent;
  }

  public async deregister(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentNotFoundError(agentId);
    }

    const now = new Date().toISOString();
    const updated: Agent = {
      ...agent,
      status: 'DEREGISTERED',
      updatedAt: now,
    };

    this.agents.set(agentId, updated);

    this.eventBus?.publish(AgentIntegrationEvents.AGENT_DEREGISTERED, {
      agentId,
      timestamp: now,
    });

    return true;
  }

  public async get(agentId: string): Promise<Agent | undefined> {
    return this.agents.get(agentId);
  }

  public async list(): Promise<Agent[]> {
    return Array.from(this.agents.values()).filter((a) => a.status !== 'DEREGISTERED');
  }

  public async updateStatus(agentId: string, status: AgentStatus): Promise<Agent> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentNotFoundError(agentId);
    }

    const previousStatus = agent.status;
    const now = new Date().toISOString();
    const updated: Agent = {
      ...agent,
      status,
      updatedAt: now,
    };

    this.agents.set(agentId, updated);

    this.eventBus?.publish(AgentIntegrationEvents.AGENT_STATUS_CHANGED, {
      agentId,
      previousStatus,
      newStatus: status,
      timestamp: now,
    });

    return updated;
  }

  public async updateCapabilities(
    agentId: string,
    capabilities: AgentCapabilitySet
  ): Promise<Agent> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new AgentNotFoundError(agentId);
    }

    const now = new Date().toISOString();
    const updated: Agent = {
      ...agent,
      capabilities,
      updatedAt: now,
    };

    this.agents.set(agentId, updated);

    this.eventBus?.publish(AgentIntegrationEvents.AGENT_CAPABILITY_CHANGED, {
      agentId,
      capabilities,
      timestamp: now,
    });

    return updated;
  }
}
