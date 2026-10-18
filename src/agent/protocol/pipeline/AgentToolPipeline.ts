import type { IAgentToolPipeline } from '../interfaces/IAgentToolPipeline.js';
import type { IAgentToolRegistry } from '../interfaces/IAgentToolRegistry.js';
import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { ToolResponse } from '../models/ToolResponse.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { Agent } from '../../models/Agent.js';
import type { IAgentSessionManager } from '../../interfaces/IAgentSessionManager.js';
import type { IAgentCapabilityResolver } from '../../interfaces/IAgentCapabilityResolver.js';
import { ToolError } from '../errors/ToolError.js';
import { ToolNotFoundError } from '../errors/ToolNotFoundError.js';
import { ToolDisabledError } from '../errors/ToolDisabledError.js';
import { ToolUnavailableError } from '../errors/ToolUnavailableError.js';
import { ToolTimeoutError } from '../errors/ToolTimeoutError.js';
import { ToolCapabilityError } from '../errors/ToolCapabilityError.js';
import { ToolScopeError } from '../errors/ToolScopeError.js';
import { ToolRequestValidator } from '../validation/ToolRequestValidator.js';
import { ToolSafetyValidator } from '../validation/ToolSafetyValidator.js';
import { ToolSchemaValidator } from '../validation/ToolSchemaValidator.js';
import { ToolIdempotencyManager } from './ToolIdempotencyManager.js';
import { SecuritySanitizer } from '../../../intelligence/agent/hardening/SecuritySanitizer.js';

export interface AgentToolPipelineOptions {
  registry: IAgentToolRegistry;
  sessionManager?: IAgentSessionManager | undefined;
  capabilityResolver?: IAgentCapabilityResolver | undefined;
  idempotencyManager?: ToolIdempotencyManager | undefined;
}

export class AgentToolPipeline implements IAgentToolPipeline {
  private readonly registry: IAgentToolRegistry;
  private readonly sessionManager?: IAgentSessionManager | undefined;
  private readonly capabilityResolver?: IAgentCapabilityResolver | undefined;
  private readonly idempotencyManager: ToolIdempotencyManager;
  private readonly handlers = new Map<string, IAgentToolHandler>();

  constructor(options: AgentToolPipelineOptions) {
    this.registry = options.registry;
    this.sessionManager = options.sessionManager;
    this.capabilityResolver = options.capabilityResolver;
    this.idempotencyManager = options.idempotencyManager ?? new ToolIdempotencyManager();
  }

  public registerHandler(handler: IAgentToolHandler): void {
    this.handlers.set(handler.toolName, handler);
  }

  public getRegistry(): IAgentToolRegistry {
    return this.registry;
  }

  public async execute(
    request: ToolRequest,
    session?: AgentSession | undefined,
    agent?: Agent | undefined
  ): Promise<ToolResponse> {
    const startTime = Date.now();
    let currentRequestId = (request && typeof request === 'object' && typeof request.requestId === 'string')
      ? request.requestId
      : 'unknown-request';
    let currentToolName = (request && typeof request === 'object' && typeof request.toolName === 'string')
      ? request.toolName
      : 'unknown-tool';

    try {
      // 1. Envelope validation
      ToolRequestValidator.validate(request);
      currentRequestId = request.requestId;
      currentToolName = request.toolName;

      // 2. Registry lookup & availability
      const tool = this.registry.getTool(request.toolName);
      if (!tool) {
        throw new ToolNotFoundError(
          `Tool '${request.toolName}' is not registered in ProjectMind tool protocol`,
          { toolName: request.toolName },
          request.requestId
        );
      }

      if (!tool.enabled) {
        throw new ToolDisabledError(
          `Tool '${tool.name}' is currently disabled in this environment`,
          { toolName: tool.name },
          request.requestId
        );
      }

      // 3. Safety validation (keys, injection, path traversal, payload size)
      ToolSafetyValidator.validate(
        request.arguments,
        tool.name,
        tool.limits.maxPayloadBytes,
        request.requestId
      );

      // 4. Session resolution and scope validation
      let activeSession = session;
      if (this.sessionManager && request.sessionId && !activeSession) {
        activeSession = await this.sessionManager.getSession(request.sessionId);
      }

      if (tool.requiredScope === 'SESSION_REQUIRED') {
        if (!request.sessionId) {
          throw new ToolScopeError(
            `Tool '${tool.name}' requires an active session, but no sessionId was provided in request`,
            { toolName: tool.name, requiredScope: tool.requiredScope },
            request.requestId
          );
        }

        if (this.sessionManager) {
          if (!activeSession) {
            throw new ToolScopeError(
              `Session '${request.sessionId}' was not found or is expired`,
              { sessionId: request.sessionId },
              request.requestId
            );
          }

          if (activeSession.status !== 'ACTIVE') {
            throw new ToolScopeError(
              `Session '${request.sessionId}' is not active (current status: ${activeSession.status})`,
              { sessionId: request.sessionId, status: activeSession.status },
              request.requestId
            );
          }
        }
      }

      if (tool.requiredScope === 'WORKSPACE_REQUIRED') {
        if (!request.workspaceId || !request.workspaceId.trim()) {
          throw new ToolScopeError(
            `Tool '${tool.name}' requires a non-empty workspaceId`,
            { toolName: tool.name },
            request.requestId
          );
        }

        if (activeSession && activeSession.workspaceId !== request.workspaceId) {
          throw new ToolScopeError(
            `Workspace mismatch: request specified '${request.workspaceId}' but session belongs to '${activeSession.workspaceId}'`,
            { requestWorkspace: request.workspaceId, sessionWorkspace: activeSession.workspaceId },
            request.requestId
          );
        }
      }

      if (tool.requiredScope === 'REPOSITORY_REQUIRED') {
        if (!request.repositoryId || !request.repositoryId.trim()) {
          throw new ToolScopeError(
            `Tool '${tool.name}' requires a non-empty repositoryId`,
            { toolName: tool.name },
            request.requestId
          );
        }

        if (activeSession && activeSession.repositoryId !== request.repositoryId) {
          throw new ToolScopeError(
            `Repository mismatch: request specified '${request.repositoryId}' but session belongs to '${activeSession.repositoryId}'`,
            { requestRepository: request.repositoryId, sessionRepository: activeSession.repositoryId },
            request.requestId
          );
        }
      }

      // 5. Capability validation
      if (agent) {
        for (const reqCap of tool.requiredCapabilities) {
          if (!agent.capabilities.has(reqCap)) {
            throw new ToolCapabilityError(
              `Agent '${agent.agentId}' lacks required capability '${reqCap}' for tool '${tool.name}'`,
              { agentId: agent.agentId, missingCapability: reqCap, toolName: tool.name },
              request.requestId
            );
          }
        }
      } else if (activeSession) {
        for (const reqCap of tool.requiredCapabilities) {
          if (!activeSession.capabilities.has(reqCap)) {
            throw new ToolCapabilityError(
              `Session '${activeSession.sessionId}' lacks required capability '${reqCap}' for tool '${tool.name}'`,
              { sessionId: activeSession.sessionId, missingCapability: reqCap, toolName: tool.name },
              request.requestId
            );
          }
        }
      }

      // 6. Schema argument validation
      ToolSchemaValidator.validate(tool.inputSchema, request.arguments, tool.name, request.requestId);

      // 7. Check Idempotency for operationId
      const opId = typeof request.arguments['operationId'] === 'string'
        ? request.arguments['operationId']
        : undefined;

      if (opId && this.idempotencyManager.has(opId)) {
        const cachedResult = this.idempotencyManager.get(opId);
        const durationMs = Date.now() - startTime;
        return {
          requestId: request.requestId,
          toolName: tool.name,
          success: true,
          result: cachedResult,
          warnings: [],
          protocolVersion: '1.0',
          timestamp: new Date().toISOString(),
          metadata: {
            durationMs,
            timestamp: new Date().toISOString(),
            protocolVersion: '1.0',
            cached: true,
          },
        };
      }

      // 8. Handler lookup
      const handler = this.handlers.get(tool.name);
      if (!handler) {
        throw new ToolUnavailableError(
          `No execution handler registered for tool '${tool.name}'`,
          { toolName: tool.name },
          request.requestId
        );
      }

      // 9. Validate with handler if handler provides custom validation
      if (typeof handler.validate === 'function') {
        await handler.validate(request);
      }

      // 10. Execute with timeout enforcement
      const toolTimeout = tool.limits.maxExecutionTimeMs ?? 10000;
      const timeoutMs = typeof request.metadata?.['timeoutMs'] === 'number'
        ? Math.min(request.metadata['timeoutMs'], toolTimeout)
        : toolTimeout;

      const rawResult = await Promise.race([
        handler.execute(request, activeSession),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new ToolTimeoutError(
                  `Execution of tool '${tool.name}' timed out after ${timeoutMs}ms`,
                  { toolName: tool.name, timeoutMs },
                  request.requestId
                )
              ),
            timeoutMs
          )
        ),
      ]);

      // 11. Redact secrets from result
      const serialized = JSON.stringify(rawResult ?? {});
      const sanitizedSerialized = SecuritySanitizer.redactSecrets(serialized);
      const sanitizedResult = JSON.parse(sanitizedSerialized) as Record<string, unknown>;

      // 12. Cache in idempotency manager if opId provided
      if (opId) {
        this.idempotencyManager.set(opId, sanitizedResult);
      }

      // 13. Build success response
      const durationMs = Date.now() - startTime;
      return {
        requestId: request.requestId,
        toolName: tool.name,
        success: true,
        result: sanitizedResult,
        warnings: [],
        protocolVersion: '1.0',
        timestamp: new Date().toISOString(),
        metadata: {
          durationMs,
          timestamp: new Date().toISOString(),
          protocolVersion: '1.0',
          cached: false,
        },
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const isToolErr = err instanceof ToolError;
      const code = isToolErr ? err.code : 'TOOL_EXECUTION_FAILED';
      const retryable = isToolErr ? err.retryable : false;
      const message = err instanceof Error ? err.message : String(err);
      const details = isToolErr ? err.details : undefined;

      return {
        requestId: currentRequestId,
        toolName: currentToolName,
        success: false,
        warnings: [],
        error: {
          code,
          message,
          retryable,
          details,
        },
        protocolVersion: '1.0',
        timestamp: new Date().toISOString(),
        metadata: {
          durationMs,
          timestamp: new Date().toISOString(),
          protocolVersion: '1.0',
        },
      };
    }
  }
}
