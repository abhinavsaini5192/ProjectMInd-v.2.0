import type { DIContainer } from '../../../workspace/di/DIContainer.js';
import type { IAgentToolPipeline } from '../../../agent/protocol/interfaces/IAgentToolPipeline.js';
import type { IAgentToolRegistry } from '../../../agent/protocol/interfaces/IAgentToolRegistry.js';
import type { IAgentSessionManager } from '../../../agent/interfaces/IAgentSessionManager.js';
import type { IAgentRegistry } from '../../../agent/interfaces/IAgentRegistry.js';
import { McpTokens } from './McpTokens.js';
import { McpServerLifecycle } from '../lifecycle/McpServerLifecycle.js';
import { McpTelemetryTracker } from '../telemetry/McpTelemetryTracker.js';
import { McpSessionManager } from '../adapters/McpSessionManager.js';
import { McpToolAdapter } from '../adapters/McpToolAdapter.js';
import { ProjectMindMcpServer } from '../server/ProjectMindMcpServer.js';

export interface CreateMcpServerOptions {
  pipeline: IAgentToolPipeline;
  registry?: IAgentToolRegistry | undefined;
  workspaceId: string;
  repositoryId: string;
  sessionManager?: IAgentSessionManager | undefined;
  agentRegistry?: IAgentRegistry | undefined;
  serverName?: string | undefined;
  serverVersion?: string | undefined;
  maxPayloadBytes?: number | undefined;
  sessionTimeoutMs?: number | undefined;
}

/**
 * Standalone factory function that instantiates and wires a complete ProjectMind MCP Server.
 */
export function createProjectMindMcpServer(options: CreateMcpServerOptions): ProjectMindMcpServer {
  const lifecycle = new McpServerLifecycle();
  const telemetry = new McpTelemetryTracker();

  const mcpSessionManager = new McpSessionManager({
    sessionManager: options.sessionManager,
    agentRegistry: options.agentRegistry,
    ...(options.sessionTimeoutMs !== undefined ? { sessionTimeoutMs: options.sessionTimeoutMs } : {}),
  });

  const toolAdapter = new McpToolAdapter({
    pipeline: options.pipeline,
    registry: options.registry ?? options.pipeline.getRegistry(),
    sessionManager: mcpSessionManager,
    ...(options.maxPayloadBytes !== undefined ? { maxPayloadBytes: options.maxPayloadBytes } : {}),
  });

  return new ProjectMindMcpServer({
    workspaceId: options.workspaceId,
    repositoryId: options.repositoryId,
    toolAdapter,
    sessionManager: mcpSessionManager,
    lifecycle,
    telemetry,
    ...(options.serverName !== undefined ? { name: options.serverName } : {}),
    ...(options.serverVersion !== undefined ? { version: options.serverVersion } : {}),
  });
}

/**
 * Registers MCP services into a DIContainer.
 */
export function registerMcpServices(container: DIContainer, options: CreateMcpServerOptions): void {
  const lifecycle = new McpServerLifecycle();
  const telemetry = new McpTelemetryTracker();

  const mcpSessionManager = new McpSessionManager({
    sessionManager: options.sessionManager,
    agentRegistry: options.agentRegistry,
    ...(options.sessionTimeoutMs !== undefined ? { sessionTimeoutMs: options.sessionTimeoutMs } : {}),
  });

  const toolAdapter = new McpToolAdapter({
    pipeline: options.pipeline,
    registry: options.registry ?? options.pipeline.getRegistry(),
    sessionManager: mcpSessionManager,
    ...(options.maxPayloadBytes !== undefined ? { maxPayloadBytes: options.maxPayloadBytes } : {}),
  });

  const server = new ProjectMindMcpServer({
    workspaceId: options.workspaceId,
    repositoryId: options.repositoryId,
    toolAdapter,
    sessionManager: mcpSessionManager,
    lifecycle,
    telemetry,
    ...(options.serverName !== undefined ? { name: options.serverName } : {}),
    ...(options.serverVersion !== undefined ? { version: options.serverVersion } : {}),
  });

  container.registerFactory(McpTokens.McpServerLifecycle, () => lifecycle, 'Singleton');
  container.registerFactory(McpTokens.McpTelemetryTracker, () => telemetry, 'Singleton');
  container.registerFactory(McpTokens.McpSessionManager, () => mcpSessionManager, 'Singleton');
  container.registerFactory(McpTokens.IMcpToolAdapter, () => toolAdapter, 'Singleton');
  container.registerFactory(McpTokens.IProjectMindMcpServer, () => server, 'Singleton');
}
