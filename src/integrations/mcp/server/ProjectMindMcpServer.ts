import * as crypto from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { IProjectMindMcpServer, McpHealthStatus } from './IProjectMindMcpServer.js';
import type { IMcpToolAdapter } from '../adapters/IMcpToolAdapter.js';
import type { IMcpTransport } from '../transport/IMcpTransport.js';
import { StdioMcpTransport } from '../transport/StdioMcpTransport.js';
import { McpServerLifecycle } from '../lifecycle/McpServerLifecycle.js';
import { McpTelemetryTracker } from '../telemetry/McpTelemetryTracker.js';
import { McpSessionManager } from '../adapters/McpSessionManager.js';
import { McpHealthService } from './McpHealthService.js';
import { McpErrorMapper } from '../errors/McpErrorMapper.js';
import { McpConstants } from '../protocol/McpConstants.js';
import type { McpSessionContext } from '../protocol/McpTypes.js';

export interface ProjectMindMcpServerOptions {
  name?: string | undefined;
  version?: string | undefined;
  workspaceId: string;
  repositoryId: string;
  toolAdapter: IMcpToolAdapter;
  sessionManager?: McpSessionManager | undefined;
  lifecycle?: McpServerLifecycle | undefined;
  telemetry?: McpTelemetryTracker | undefined;
}

/**
 * Standard MCP Server for ProjectMind.
 * Acts as a thin protocol coordinator wiring external MCP transports and SDK to
 * the canonical ProjectMind AgentToolPipeline via McpToolAdapter.
 */
export class ProjectMindMcpServer implements IProjectMindMcpServer {
  private readonly mcpServer: Server;
  private readonly toolAdapter: IMcpToolAdapter;
  private readonly sessionManager?: McpSessionManager | undefined;
  private readonly lifecycle: McpServerLifecycle;
  private readonly telemetry: McpTelemetryTracker;
  private readonly healthService: McpHealthService;
  private readonly workspaceId: string;
  private readonly repositoryId: string;
  private sessionContext: McpSessionContext;
  private activeTransport?: IMcpTransport | undefined;

  constructor(options: ProjectMindMcpServerOptions) {
    this.workspaceId = options.workspaceId;
    this.repositoryId = options.repositoryId;
    this.toolAdapter = options.toolAdapter;
    this.sessionManager = options.sessionManager;
    this.lifecycle = options.lifecycle ?? new McpServerLifecycle();
    this.telemetry = options.telemetry ?? new McpTelemetryTracker();
    this.healthService = new McpHealthService(
      this.lifecycle,
      this.telemetry,
      this.toolAdapter,
      this.sessionManager
    );

    const now = Date.now();
    this.sessionContext = {
      sessionId: crypto.randomUUID(),
      workspaceId: this.workspaceId,
      repositoryId: this.repositoryId,
      startedAt: now,
      lastActiveAt: now,
    };

    // Strictly declare ONLY tools capability. No prompts, resources, or sampling.
    this.mcpServer = new Server(
      {
        name: options.name ?? McpConstants.DEFAULT_SERVER_NAME,
        version: options.version ?? McpConstants.DEFAULT_SERVER_VERSION,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerHandlers();
  }

  private registerHandlers(): void {
    // 1. List tools handler
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      this.lifecycle.enterRequest();
      try {
        const tools = await this.toolAdapter.listTools();
        return {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema as Record<string, unknown>,
          })),
        };
      } finally {
        this.lifecycle.exitRequest();
      }
    });

    // 2. Call tool handler
    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      this.lifecycle.enterRequest();
      const startTime = Date.now();
      const toolName = request.params.name;

      try {
        const result = await this.toolAdapter.executeTool(
          {
            name: toolName,
            arguments: request.params.arguments,
          },
          this.sessionContext
        );

        this.telemetry.recordToolExecution(
          toolName,
          Date.now() - startTime,
          !result.isError,
          result.isError ? 'TOOL_ERROR' : undefined
        );

        return {
          content: result.content,
          ...(result.isError !== undefined ? { isError: result.isError } : {}),
        };
      } catch (err) {
        this.telemetry.recordToolExecution(
          toolName,
          Date.now() - startTime,
          false,
          'UNHANDLED_ERROR'
        );
        return McpErrorMapper.toCallToolResult(err);
      } finally {
        this.lifecycle.exitRequest();
      }
    });
  }

  /**
   * Starts the server on the given transport (defaults to StdioMcpTransport).
   */
  public async start(transport?: IMcpTransport | undefined): Promise<void> {
    const active = transport ?? new StdioMcpTransport();
    this.activeTransport = active;

    if (this.sessionManager) {
      try {
        this.sessionContext = await this.sessionManager.initializeSession({
          workspaceId: this.workspaceId,
          repositoryId: this.repositoryId,
        });
      } catch {
        // Fall back to default sessionContext if sessionManager throws
      }
    }

    await this.mcpServer.connect(active as any);
    this.lifecycle.start();
  }

  /**
   * Gracefully drains requests and stops the server and transport.
   */
  public async stop(): Promise<void> {
    await this.lifecycle.stop();

    try {
      await this.mcpServer.close();
    } catch {
      // Ignore errors on close
    }

    if (this.activeTransport) {
      try {
        await this.activeTransport.close();
      } catch {
        // Ignore errors on transport close
      }
      this.activeTransport = undefined;
    }

    if (this.sessionManager) {
      try {
        await this.sessionManager.closeSession(this.sessionContext.sessionId, 'SERVER_STOP');
      } catch {
        // Ignore errors on closing session
      }
    }
  }

  public getLifecycle(): McpServerLifecycle {
    return this.lifecycle;
  }

  public getTelemetry(): McpTelemetryTracker {
    return this.telemetry;
  }

  public getSessionContext(): McpSessionContext {
    return this.sessionContext;
  }

  public async getHealth(): Promise<McpHealthStatus> {
    return this.healthService.getHealth();
  }
}
