import type { Agent } from '../../models/Agent.js';
import type { AgentSession, AgentSessionCreateParams } from '../../models/AgentSession.js';
import type { IAgentSessionCoordinator, SessionScopeParams } from '../interfaces/IAgentSessionCoordinator.js';
import type { IAgentSessionManager } from '../../interfaces/IAgentSessionManager.js';
import type { IAgentRuntimeTelemetry } from '../interfaces/IAgentRuntimeTelemetry.js';
import { RuntimeCapacityError, RuntimeScopeError } from '../errors/AgentRuntimeError.js';

export class AgentSessionCoordinator implements IAgentSessionCoordinator {
  private readonly activeSessionIds = new Set<string>();

  constructor(
    private readonly sessionManager: IAgentSessionManager,
    private readonly maxConcurrentSessions: number = 50,
    private readonly telemetry?: IAgentRuntimeTelemetry | undefined
  ) {}

  public async createSession(params: AgentSessionCreateParams, agent: Agent): Promise<AgentSession> {
    if (this.activeSessionIds.size >= this.maxConcurrentSessions) {
      this.telemetry?.incrementRejectedRequests();
      throw new RuntimeCapacityError(
        'Cannot create agent session: capacity limit reached',
        'SESSIONS',
        this.maxConcurrentSessions,
        this.activeSessionIds.size
      );
    }

    const session = await this.sessionManager.createSession(params, agent);
    this.activeSessionIds.add(session.sessionId);
    this.telemetry?.updateActiveSessionsGauge?.(this.activeSessionIds.size);
    return session;
  }

  public async getSession(sessionId: string, scope?: SessionScopeParams): Promise<AgentSession | undefined> {
    const session = await this.sessionManager.getSession(sessionId);
    if (!session) {
      return undefined;
    }

    if (scope?.workspaceId && session.workspaceId !== scope.workspaceId) {
      throw new RuntimeScopeError(
        `Session '${sessionId}' belongs to workspace '${session.workspaceId}', but caller specified '${scope.workspaceId}'`,
        { workspaceId: scope.workspaceId, sessionId }
      );
    }

    if (scope?.repositoryId && session.repositoryId !== scope.repositoryId) {
      throw new RuntimeScopeError(
        `Session '${sessionId}' belongs to repository '${session.repositoryId}', but caller specified '${scope.repositoryId}'`,
        { repositoryId: scope.repositoryId, sessionId }
      );
    }

    return session;
  }

  public async terminateSession(sessionId: string, scope?: SessionScopeParams): Promise<void> {
    const session = await this.getSession(sessionId, scope);
    if (session) {
      await this.sessionManager.closeSession(sessionId, 'Session terminated by runtime coordinator');
    }
    this.activeSessionIds.delete(sessionId);
    this.telemetry?.updateActiveSessionsGauge?.(this.activeSessionIds.size);
  }

  public async listActiveSessions(workspaceId?: string): Promise<readonly AgentSession[]> {
    const sessions: AgentSession[] = [];
    for (const sessionId of this.activeSessionIds) {
      const s = await this.sessionManager.getSession(sessionId);
      if (s && s.status === 'ACTIVE') {
        if (!workspaceId || s.workspaceId === workspaceId) {
          sessions.push(s);
        }
      } else if (s && s.status !== 'ACTIVE') {
        this.activeSessionIds.delete(sessionId);
      }
    }
    this.telemetry?.updateActiveSessionsGauge?.(this.activeSessionIds.size);
    return sessions;
  }

  public getActiveSessionCount(): number {
    return this.activeSessionIds.size;
  }
}
