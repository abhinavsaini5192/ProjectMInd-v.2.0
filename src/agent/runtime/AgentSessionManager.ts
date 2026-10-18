import type { Agent } from '../models/Agent.js';
import type { AgentSession, AgentSessionCreateParams } from '../models/AgentSession.js';
import type { AgentWorkspaceContext } from '../models/AgentWorkspaceContext.js';
import { AgentCapabilitySet } from '../models/AgentCapabilitySet.js';
import type { IAgentSessionManager } from '../interfaces/IAgentSessionManager.js';
import { AgentScopeError } from '../errors/AgentScopeError.js';
import { AgentOperationError } from '../errors/AgentOperationError.js';
import { AgentSessionNotFoundError } from '../errors/AgentSessionNotFoundError.js';
import { AgentCapabilityError } from '../errors/AgentCapabilityError.js';
import { AgentIntegrationEvents } from '../events/AgentIntegrationEvents.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';
import { CURRENT_AGENT_PROTOCOL_VERSION } from '../models/AgentProtocolVersion.js';

export interface AgentSessionManagerOptions {
  readonly sessionTtlMs?: number | undefined;
}

export class AgentSessionManager implements IAgentSessionManager {
  private readonly sessions = new Map<string, AgentSession>();
  private readonly sessionTtlMs: number;

  constructor(
    private readonly eventBus?: IEventBus | undefined,
    options?: AgentSessionManagerOptions | undefined
  ) {
    this.sessionTtlMs = options?.sessionTtlMs ?? 3600000; // 1 hour default TTL
  }

  public async createSession(
    params: AgentSessionCreateParams,
    agent: Agent
  ): Promise<AgentSession> {
    if (agent.status !== 'ACTIVE') {
      throw new AgentOperationError(
        `Cannot create session: agent '${agent.agentId}' is not ACTIVE (current status: ${agent.status})`
      );
    }

    if (!params.workspaceId || typeof params.workspaceId !== 'string' || params.workspaceId.trim() === '') {
      throw new AgentScopeError('Session creation requires a valid workspaceId', { params });
    }
    if (!params.repositoryId || typeof params.repositoryId !== 'string' || params.repositoryId.trim() === '') {
      throw new AgentScopeError('Session creation requires a valid repositoryId', { params });
    }

    let sessionCapabilities: AgentCapabilitySet;
    if (params.requestedCapabilities) {
      const requestedSet =
        params.requestedCapabilities instanceof AgentCapabilitySet
          ? params.requestedCapabilities
          : new AgentCapabilitySet(params.requestedCapabilities);

      for (const cap of requestedSet.toArray()) {
        if (!agent.capabilities.has(cap)) {
          throw new AgentCapabilityError(
            `Agent '${agent.agentId}' lacks requested session capability '${cap}'`,
            [cap],
            { agentId: agent.agentId }
          );
        }
      }
      sessionCapabilities = requestedSet;
    } else {
      sessionCapabilities = agent.capabilities.clone();
    }

    const now = new Date().toISOString();
    const rand = Math.random().toString(36).substring(2, 8);
    const sessionId = `sess_${agent.agentId}_${Date.now()}_${rand}`;
    const protocolVersion = params.protocolVersion ?? CURRENT_AGENT_PROTOCOL_VERSION;

    const session: AgentSession = {
      sessionId,
      agentId: agent.agentId,
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      branch: params.branch,
      commit: params.commit,
      workingTreeState: params.workingTreeState ?? 'UNKNOWN',
      taskId: params.taskId,
      createdAt: now,
      lastActivityAt: now,
      status: 'ACTIVE',
      capabilities: sessionCapabilities,
      protocolVersion,
      metadata: params.metadata,
    };

    this.sessions.set(sessionId, session);

    this.eventBus?.publish(AgentIntegrationEvents.AGENT_SESSION_CREATED, {
      session,
      timestamp: now,
    });

    return session;
  }

  public async getSession(sessionId: string): Promise<AgentSession | undefined> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    if (session.status === 'ACTIVE') {
      const lastActive = new Date(session.lastActivityAt).getTime();
      if (Date.now() - lastActive > this.sessionTtlMs) {
        const expired: AgentSession = {
          ...session,
          status: 'EXPIRED',
        };
        this.sessions.set(sessionId, expired);
        return expired;
      }
    }

    return session;
  }

  public async touchSession(sessionId: string): Promise<AgentSession> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new AgentSessionNotFoundError(sessionId);
    }
    if (session.status !== 'ACTIVE') {
      throw new AgentOperationError(
        `Cannot touch session '${sessionId}': session is ${session.status}`
      );
    }

    const updated: AgentSession = {
      ...session,
      lastActivityAt: new Date().toISOString(),
    };
    this.sessions.set(sessionId, updated);
    return updated;
  }

  public async closeSession(sessionId: string, reason?: string | undefined): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new AgentSessionNotFoundError(sessionId);
    }

    const now = new Date().toISOString();
    const updated: AgentSession = {
      ...session,
      status: 'TERMINATED',
      lastActivityAt: now,
    };
    this.sessions.set(sessionId, updated);

    this.eventBus?.publish(AgentIntegrationEvents.AGENT_SESSION_CLOSED, {
      sessionId,
      agentId: session.agentId,
      reason,
      timestamp: now,
    });

    return true;
  }

  public async listSessionsForAgent(agentId: string): Promise<AgentSession[]> {
    return Array.from(this.sessions.values()).filter((s) => s.agentId === agentId);
  }

  public validateSessionScope(session: AgentSession, context: AgentWorkspaceContext): void {
    if (session.workspaceId !== context.workspaceId) {
      throw new AgentScopeError(
        `Session workspaceId mismatch: session bound to '${session.workspaceId}', request scoped to '${context.workspaceId}'`,
        { sessionWorkspaceId: session.workspaceId, requestWorkspaceId: context.workspaceId }
      );
    }
    if (session.repositoryId !== context.repositoryId) {
      throw new AgentScopeError(
        `Session repositoryId mismatch: session bound to '${session.repositoryId}', request scoped to '${context.repositoryId}'`,
        { sessionRepositoryId: session.repositoryId, requestRepositoryId: context.repositoryId }
      );
    }
  }
}
