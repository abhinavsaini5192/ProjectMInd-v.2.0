import * as crypto from 'node:crypto';
import type { IMcpToolAdapter } from './IMcpToolAdapter.js';
import type {
  McpToolDefinition,
  McpToolCallParams,
  McpCallToolResult,
  McpSessionContext,
} from '../protocol/McpTypes.js';
import type { IAgentToolPipeline } from '../../../agent/protocol/interfaces/IAgentToolPipeline.js';
import type { IAgentToolRegistry } from '../../../agent/protocol/interfaces/IAgentToolRegistry.js';
import type { ToolRequest } from '../../../agent/protocol/models/ToolRequest.js';
import type { McpSessionManager } from './McpSessionManager.js';
import { McpSchemaTranslator } from '../schemas/McpSchemaTranslator.js';
import { McpSecurityValidator } from '../security/McpSecurityValidator.js';
import { McpErrorMapper } from '../errors/McpErrorMapper.js';
import { McpConstants } from '../protocol/McpConstants.js';
import { ToolRequestValidator } from '../../../agent/protocol/validation/ToolRequestValidator.js';

export interface McpToolAdapterOptions {
  pipeline: IAgentToolPipeline;
  registry?: IAgentToolRegistry | undefined;
  sessionManager?: McpSessionManager | undefined;
  maxPayloadBytes?: number | undefined;
}

/**
 * Concrete adapter that dynamically translates tool metadata and requests
 * between the Model Context Protocol and ProjectMind canonical AgentToolPipeline.
 */
export class McpToolAdapter implements IMcpToolAdapter {
  private readonly pipeline: IAgentToolPipeline;
  private readonly registry: IAgentToolRegistry;
  private readonly sessionManager?: McpSessionManager | undefined;
  private readonly maxPayloadBytes: number;

  constructor(options: McpToolAdapterOptions) {
    this.pipeline = options.pipeline;
    this.registry = options.registry ?? options.pipeline.getRegistry();
    this.sessionManager = options.sessionManager;
    this.maxPayloadBytes = options.maxPayloadBytes ?? McpConstants.DEFAULT_MAX_PAYLOAD_BYTES;
  }

  /**
   * Discovers tools registered in the canonical tool protocol and maps
   * them into MCP ToolDefinitions with Draft-7 schemas.
   */
  public async listTools(): Promise<McpToolDefinition[]> {
    const canonicalTools = this.registry.listTools();

    return canonicalTools
      .filter((tool) => tool.enabled !== false)
      .map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: McpSchemaTranslator.translateInputSchema(tool.inputSchema),
      }));
  }

  /**
   * Translates an incoming MCP tool call into a canonical ToolRequest, executes it
   * via AgentToolPipeline, and formats the response as a CallToolResult.
   */
  public async executeTool(
    params: McpToolCallParams,
    sessionContext: McpSessionContext
  ): Promise<McpCallToolResult> {
    const requestId = crypto.randomUUID();

    try {
      // 1. Security validation of arguments
      McpSecurityValidator.validateArguments(params.arguments, this.maxPayloadBytes);

      // 2. Resolve session context if sessionManager is configured
      let session;
      let agent;
      if (this.sessionManager) {
        const resolved = await this.sessionManager.resolveSession(sessionContext.sessionId);
        session = resolved?.session;
        agent = resolved?.agent;
      }

      // 3. Build canonical ToolRequest
      const request: ToolRequest = {
        requestId,
        sessionId: sessionContext.sessionId,
        agentId: sessionContext.agentId ?? session?.agentId ?? 'mcp-agent',
        protocolVersion: ToolRequestValidator.SUPPORTED_PROTOCOL_VERSION,
        toolName: params.name,
        arguments: params.arguments ?? {},
        workspaceId: sessionContext.workspaceId,
        repositoryId: sessionContext.repositoryId,
        timestamp: new Date().toISOString(),
      };

      // 4. Delegate to canonical AgentToolPipeline
      const response = await this.pipeline.execute(request, session);

      // 5. Format CallToolResult
      if (response.success) {
        const formattedText =
          typeof response.result === 'string'
            ? response.result
            : JSON.stringify(response.result, null, 2);

        const sanitizedText = McpSecurityValidator.sanitizeOutput(formattedText);

        return {
          content: [
            {
              type: 'text',
              text: sanitizedText,
            },
          ],
        };
      } else {
        return McpErrorMapper.toCallToolResult(response.error, requestId);
      }
    } catch (error) {
      return McpErrorMapper.toCallToolResult(error, requestId);
    }
  }
}
