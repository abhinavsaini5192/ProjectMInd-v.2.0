import type { Agent } from '../models/Agent.js';
import type { AgentSession, AgentSessionCreateParams } from '../models/AgentSession.js';
import type { AgentWorkspaceContext } from '../models/AgentWorkspaceContext.js';

export interface IAgentSessionManager {
  createSession(params: AgentSessionCreateParams, agent: Agent): Promise<AgentSession>;
  getSession(sessionId: string): Promise<AgentSession | undefined>;
  touchSession(sessionId: string): Promise<AgentSession>;
  closeSession(sessionId: string, reason?: string | undefined): Promise<boolean>;
  listSessionsForAgent(agentId: string): Promise<AgentSession[]>;
  validateSessionScope(session: AgentSession, context: AgentWorkspaceContext): void;
}
