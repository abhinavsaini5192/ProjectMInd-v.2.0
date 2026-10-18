import type { Agent, AgentRegistrationParams } from '../models/Agent.js';
import type { AgentSession, AgentSessionCreateParams } from '../models/AgentSession.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentResponse } from '../models/AgentResponse.js';

/**
 * Phase 7.1 Agent Integration Runtime Interface.
 */
export interface IAgentRuntime {
  registerAgent(params: AgentRegistrationParams): Promise<Agent>;
  deregisterAgent(agentId: string): Promise<boolean>;
  getAgent(agentId: string): Promise<Agent | undefined>;
  listAgents(): Promise<Agent[]>;
  createSession(params: AgentSessionCreateParams): Promise<AgentSession>;
  getSession(sessionId: string): Promise<AgentSession | undefined>;
  closeSession(sessionId: string): Promise<boolean>;
  executeOperation<TPayload = unknown, TData = unknown>(
    request: AgentRequest<TPayload>
  ): Promise<AgentResponse<TData>>;
}
