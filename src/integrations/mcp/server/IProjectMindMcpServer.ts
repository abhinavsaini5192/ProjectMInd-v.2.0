import type { IMcpTransport } from '../transport/IMcpTransport.js';
import type { McpServerLifecycle } from '../lifecycle/McpServerLifecycle.js';
import type { McpTelemetryTracker } from '../telemetry/McpTelemetryTracker.js';
import type { McpSessionContext } from '../protocol/McpTypes.js';

export interface McpHealthStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  state: string;
  uptimeSeconds: number;
  activeRequests: number;
  totalRequests: number;
  activeSessions: number;
  toolCount: number;
}

/**
 * High-level MCP server interface for ProjectMind.
 */
export interface IProjectMindMcpServer {
  /**
   * Starts the MCP server on the specified transport (or Stdio by default).
   */
  start(transport?: IMcpTransport | undefined): Promise<void>;

  /**
   * Gracefully drains in-flight requests and shuts down the MCP server.
   */
  stop(): Promise<void>;

  /**
   * Lifecycle manager.
   */
  getLifecycle(): McpServerLifecycle;

  /**
   * Telemetry metrics tracker.
   */
  getTelemetry(): McpTelemetryTracker;

  /**
   * Active session context.
   */
  getSessionContext(): McpSessionContext;

  /**
   * Diagnostic health status.
   */
  getHealth(): Promise<McpHealthStatus>;
}
