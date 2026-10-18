import type { Agent, AgentRegistrationParams } from '../models/Agent.js';
import type { AgentStatus } from '../models/AgentStatus.js';
import type { AgentCapabilitySet } from '../models/AgentCapabilitySet.js';

export interface IAgentRegistry {
  register(params: AgentRegistrationParams): Promise<Agent>;
  deregister(agentId: string): Promise<boolean>;
  get(agentId: string): Promise<Agent | undefined>;
  list(): Promise<Agent[]>;
  updateStatus(agentId: string, status: AgentStatus): Promise<Agent>;
  updateCapabilities(agentId: string, capabilities: AgentCapabilitySet): Promise<Agent>;
}
