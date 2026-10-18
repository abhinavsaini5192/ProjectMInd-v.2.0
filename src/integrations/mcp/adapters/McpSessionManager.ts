import * as crypto from 'node:crypto';
import type { IAgentSessionManager } from '../../../agent/interfaces/IAgentSessionManager.js';
import type { IAgentRegistry } from '../../../agent/interfaces/IAgentRegistry.js';
import type { Agent } from '../../../agent/models/Agent.js';
import type { AgentSession } from '../../../agent/models/AgentSession.js';
import type { McpClientInfo, McpSessionContext } from '../protocol/McpTypes.js';
import { McpIdentityMapper } from './McpIdentityMapper.js';
import { McpConstants } from '../protocol/McpConstants.js';
import { McpError } from '../errors/McpError.js';
import { McpErrorCodes } from '../errors/McpErrorCodes.js';

export interface McpSessionManagerOptions {
  sessionManager?: IAgentSessionManager | undefined;
  agentRegistry?: IAgentRegistry | undefined;
  sessionTimeoutMs?: number | undefined;
}

export interface McpSessionRecord {
  sessionContext: McpSessionContext;
  session?: AgentSession | undefined;
  agent?: Agent | undefined;
}

export class McpSessionManager {
  private readonly sessionManager?: IAgentSessionManager | undefined;
  private readonly agentRegistry?: IAgentRegistry | undefined;
  private readonly sessionTimeoutMs: number;
  private readonly sessions = new Map<string, McpSessionRecord>();

  constructor(options: McpSessionManagerOptions = {}) {
    this.sessionManager = options.sessionManager;
    this.agentRegistry = options.agentRegistry;
    this.sessionTimeoutMs = options.sessionTimeoutMs ?? McpConstants.DEFAULT_SESSION_TIMEOUT_MS;
  }

  /**
   * Initializes a new MCP session, creating or associating the canonical Agent and AgentSession.
   */
  public async initializeSession(params: {
    workspaceId: string;
    repositoryId: string;
    clientInfo?: McpClientInfo | undefined;
    agentId?: string | undefined;
    branch?: string | undefined;
    commit?: string | undefined;
  }): Promise<McpSessionContext> {
    if (!params.workspaceId || !params.repositoryId) {
      throw new McpError(
        'Workspace ID and Repository ID are required to initialize an MCP session',
        McpErrorCodes.INVALID_PARAMS
      );
    }

    const registrationParams = McpIdentityMapper.mapClientToAgent(params.clientInfo, params.agentId);

    let agent: Agent | undefined;
    if (this.agentRegistry) {
      const existing = await this.agentRegistry.get(registrationParams.agentId);
      if (existing) {
        agent = existing;
      } else {
        agent = await this.agentRegistry.register(registrationParams);
      }
    }

    let agentSession: AgentSession | undefined;
    let sessionId: string = crypto.randomUUID();

    if (this.sessionManager && agent) {
      agentSession = await this.sessionManager.createSession(
        {
          agentId: agent.agentId,
          workspaceId: params.workspaceId,
          repositoryId: params.repositoryId,
          ...(params.branch !== undefined ? { branch: params.branch } : {}),
          ...(params.commit !== undefined ? { commit: params.commit } : {}),
          requestedCapabilities: registrationParams.capabilities,
          metadata: {
            clientName: params.clientInfo?.name,
            clientVersion: params.clientInfo?.version,
          },
        },
        agent
      );
      sessionId = agentSession.sessionId;
    }

    const now = Date.now();
    const sessionContext: McpSessionContext = {
      sessionId,
      agentId: agent?.agentId ?? registrationParams.agentId,
      workspaceId: params.workspaceId,
      repositoryId: params.repositoryId,
      ...(params.clientInfo !== undefined ? { clientInfo: params.clientInfo } : {}),
      startedAt: now,
      lastActiveAt: now,
    };

    const record: McpSessionRecord = {
      sessionContext,
      ...(agentSession !== undefined ? { session: agentSession } : {}),
      ...(agent !== undefined ? { agent } : {}),
    };

    this.sessions.set(sessionId, record);
    return sessionContext;
  }

  /**
   * Resolves an active session and updates its last activity timestamp.
   */
  public async resolveSession(sessionId: string): Promise<McpSessionRecord | undefined> {
    const record = this.sessions.get(sessionId);
    if (!record) {
      return undefined;
    }

    const now = Date.now();
    if (now - record.sessionContext.lastActiveAt > this.sessionTimeoutMs) {
      await this.closeSession(sessionId, 'SESSION_TIMEOUT');
      throw new McpError('Session has expired due to inactivity', McpErrorCodes.SESSION_EXPIRED, {
        sessionId,
      });
    }

    record.sessionContext.lastActiveAt = now;
    if (this.sessionManager) {
      try {
        const touched = await this.sessionManager.touchSession(sessionId);
        record.session = touched;
      } catch {
        // Fall back to in-memory timestamp if sessionManager fails or is mock
      }
    }

    return record;
  }

  /**
   * Validates that an operation's workspace and repository match the session boundary.
   */
  public validateSessionScope(
    sessionContext: McpSessionContext,
    targetWorkspaceId: string,
    targetRepositoryId: string
  ): void {
    if (sessionContext.workspaceId !== targetWorkspaceId) {
      throw new McpError(
        `Workspace scope violation: Session bound to '${sessionContext.workspaceId}', attempted access to '${targetWorkspaceId}'`,
        McpErrorCodes.SCOPE_VIOLATION,
        { sessionWorkspace: sessionContext.workspaceId, targetWorkspaceId }
      );
    }

    if (sessionContext.repositoryId !== targetRepositoryId) {
      throw new McpError(
        `Repository scope violation: Session bound to '${sessionContext.repositoryId}', attempted access to '${targetRepositoryId}'`,
        McpErrorCodes.SCOPE_VIOLATION,
        { sessionRepository: sessionContext.repositoryId, targetRepositoryId }
      );
    }
  }

  /**
   * Terminates a session.
   */
  public async closeSession(sessionId: string, reason?: string): Promise<boolean> {
    const record = this.sessions.get(sessionId);
    if (!record) {
      return false;
    }

    this.sessions.delete(sessionId);

    if (this.sessionManager) {
      try {
        await this.sessionManager.closeSession(sessionId, reason);
      } catch {
        // Ignore errors during closing
      }
    }

    return true;
  }

  /**
   * Lists currently active session IDs.
   */
  public getActiveSessionCount(): number {
    return this.sessions.size;
  }
}
