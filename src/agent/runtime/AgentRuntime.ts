import type { Agent, AgentRegistrationParams } from '../models/Agent.js';
import type { AgentSession, AgentSessionCreateParams } from '../models/AgentSession.js';
import type { AgentRequest } from '../models/AgentRequest.js';
import type { AgentResponse } from '../models/AgentResponse.js';
import { CURRENT_AGENT_PROTOCOL_VERSION } from '../models/AgentProtocolVersion.js';
import type { IAgentRuntime } from '../interfaces/IAgentRuntime.js';
import type { IAgentRegistry } from '../interfaces/IAgentRegistry.js';
import type { IAgentSessionManager } from '../interfaces/IAgentSessionManager.js';
import type { IAgentCapabilityResolver } from '../interfaces/IAgentCapabilityResolver.js';
import type { IAgentOperationRouter } from '../interfaces/IAgentOperationRouter.js';
import { AgentRequestValidator } from './AgentRequestValidator.js';
import { AgentError } from '../errors/AgentError.js';
import { AgentNotFoundError } from '../errors/AgentNotFoundError.js';
import { AgentSessionNotFoundError } from '../errors/AgentSessionNotFoundError.js';
import { AgentOperationError } from '../errors/AgentOperationError.js';
import { AgentScopeError } from '../errors/AgentScopeError.js';
import { AgentIntegrationEvents } from '../events/AgentIntegrationEvents.js';
import type { IEventBus } from '../../workspace/interfaces/IEventBus.js';

export interface AgentRuntimeDependencies {
  readonly registry: IAgentRegistry;
  readonly sessionManager: IAgentSessionManager;
  readonly capabilityResolver: IAgentCapabilityResolver;
  readonly router: IAgentOperationRouter;
  readonly eventBus?: IEventBus | undefined;
}

export class AgentRuntime implements IAgentRuntime {
  private readonly registry: IAgentRegistry;
  private readonly sessionManager: IAgentSessionManager;
  private readonly capabilityResolver: IAgentCapabilityResolver;
  private readonly router: IAgentOperationRouter;
  private readonly eventBus?: IEventBus | undefined;

  constructor(deps: AgentRuntimeDependencies) {
    this.registry = deps.registry;
    this.sessionManager = deps.sessionManager;
    this.capabilityResolver = deps.capabilityResolver;
    this.router = deps.router;
    this.eventBus = deps.eventBus;
  }

  public async registerAgent(params: AgentRegistrationParams): Promise<Agent> {
    return this.registry.register(params);
  }

  public async deregisterAgent(agentId: string): Promise<boolean> {
    return this.registry.deregister(agentId);
  }

  public async getAgent(agentId: string): Promise<Agent | undefined> {
    return this.registry.get(agentId);
  }

  public async listAgents(): Promise<Agent[]> {
    return this.registry.list();
  }

  public async createSession(params: AgentSessionCreateParams): Promise<AgentSession> {
    const agent = await this.registry.get(params.agentId);
    if (!agent) {
      throw new AgentNotFoundError(params.agentId);
    }
    return this.sessionManager.createSession(params, agent);
  }

  public async getSession(sessionId: string): Promise<AgentSession | undefined> {
    return this.sessionManager.getSession(sessionId);
  }

  public async closeSession(sessionId: string): Promise<boolean> {
    return this.sessionManager.closeSession(sessionId);
  }

  public async executeOperation<TPayload = unknown, TData = unknown>(
    request: AgentRequest<TPayload>
  ): Promise<AgentResponse<TData>> {
    const startTime = Date.now();
    const nowIso = new Date().toISOString();

    this.eventBus?.publish(AgentIntegrationEvents.AGENT_REQUEST_RECEIVED, {
      request,
      timestamp: nowIso,
    });

    try {
      // 1. Envelope & Scope Validation
      AgentRequestValidator.validate(request as AgentRequest);

      // 2. Resolve & Check Agent
      const agent = await this.registry.get(request.agentId);
      if (!agent) {
        throw new AgentNotFoundError(request.agentId);
      }
      if (agent.status !== 'ACTIVE') {
        throw new AgentOperationError(
          `Agent '${agent.agentId}' is not ACTIVE (current status: ${agent.status})`,
          request.operation
        );
      }

      // 3. Resolve & Check Session (if supplied)
      let session: AgentSession | undefined;
      if (request.sessionId) {
        session = await this.sessionManager.getSession(request.sessionId);
        if (!session) {
          throw new AgentSessionNotFoundError(request.sessionId);
        }
        if (session.status !== 'ACTIVE') {
          throw new AgentOperationError(
            `Session '${session.sessionId}' is not ACTIVE (current status: ${session.status})`,
            request.operation
          );
        }
        if (session.agentId !== agent.agentId) {
          throw new AgentScopeError(
            `Session '${session.sessionId}' belongs to agent '${session.agentId}', not '${agent.agentId}'`,
            { sessionId: session.sessionId, agentId: agent.agentId }
          );
        }
        this.sessionManager.validateSessionScope(session, request.workspaceContext);
        await this.sessionManager.touchSession(session.sessionId);
      }

      // 4. Retrieve Handler
      const handler = this.router.getHandler(request.operation);
      if (!handler) {
        throw new AgentOperationError(
          `No handler registered for operation '${request.operation}'`,
          request.operation
        );
      }

      // 5. Enforce Trust & Required Capabilities
      this.capabilityResolver.assertCanPerform(
        agent,
        session,
        request.operation,
        handler.requiredCapabilities
      );

      // 6. Execute Handler
      const data = (await this.router.route(request as AgentRequest, session)) as TData;
      const durationMs = Date.now() - startTime;

      const response: AgentResponse<TData> = {
        requestId: request.requestId,
        status: 'SUCCESS',
        data,
        metadata: {
          durationMs,
          timestamp: new Date().toISOString(),
          protocolVersion: request.protocolVersion,
          traceId: request.traceId,
        },
      };

      this.eventBus?.publish(AgentIntegrationEvents.AGENT_REQUEST_COMPLETED, {
        request,
        response,
        durationMs,
        timestamp: response.metadata.timestamp,
      });

      return response;
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      let code = 'AGENT_OPERATION_ERROR';
      let message = 'An unexpected error occurred during agent operation execution';
      let details: unknown = undefined;

      if (err instanceof AgentError) {
        code = err.code;
        message = err.message;
        details = err.details;
      } else if (err instanceof Error) {
        message = err.message;
      } else {
        message = String(err);
      }

      const response: AgentResponse<TData> = {
        requestId: request?.requestId ?? 'unknown',
        status: 'ERROR',
        error: { code, message, details },
        metadata: {
          durationMs,
          timestamp: new Date().toISOString(),
          protocolVersion: request?.protocolVersion ?? CURRENT_AGENT_PROTOCOL_VERSION,
          traceId: request?.traceId,
        },
      };

      this.eventBus?.publish(AgentIntegrationEvents.AGENT_REQUEST_FAILED, {
        request,
        error: { code, message, details },
        durationMs,
        timestamp: response.metadata.timestamp,
      });

      return response;
    }
  }
}
