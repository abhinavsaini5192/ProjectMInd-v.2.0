import type { Agent } from '../../models/Agent.js';
import type { AgentSession, AgentSessionCreateParams } from '../../models/AgentSession.js';

export interface SessionScopeParams {
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
}

export interface IAgentSessionCoordinator {
  createSession(params: AgentSessionCreateParams, agent: Agent): Promise<AgentSession>;
  getSession(sessionId: string, scope?: SessionScopeParams): Promise<AgentSession | undefined>;
  terminateSession(sessionId: string, scope?: SessionScopeParams): Promise<void>;
  listActiveSessions(workspaceId?: string): Promise<readonly AgentSession[]>;
  getActiveSessionCount(): number;
}
