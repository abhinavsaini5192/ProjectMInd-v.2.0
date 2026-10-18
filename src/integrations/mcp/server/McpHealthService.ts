import type { McpHealthStatus } from './IProjectMindMcpServer.js';
import type { McpServerLifecycle } from '../lifecycle/McpServerLifecycle.js';
import type { McpTelemetryTracker } from '../telemetry/McpTelemetryTracker.js';
import type { McpSessionManager } from '../adapters/McpSessionManager.js';
import type { IMcpToolAdapter } from '../adapters/IMcpToolAdapter.js';

export class McpHealthService {
  constructor(
    private readonly lifecycle: McpServerLifecycle,
    private readonly telemetry: McpTelemetryTracker,
    private readonly toolAdapter: IMcpToolAdapter,
    private readonly sessionManager?: McpSessionManager | undefined
  ) {}

  public async getHealth(): Promise<McpHealthStatus> {
    const state = this.lifecycle.getState();
    const snapshot = this.telemetry.getSnapshot();

    let toolCount = 0;
    try {
      const tools = await this.toolAdapter.listTools();
      toolCount = tools.length;
    } catch {
      toolCount = 0;
    }

    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
    if (state === 'FAILED') {
      status = 'UNHEALTHY';
    } else if (state === 'DRAINING' || state === 'STOPPING' || state === 'STOPPED') {
      status = 'DEGRADED';
    } else if (snapshot.totalRequests > 10 && snapshot.failedRequests / snapshot.totalRequests > 0.5) {
      status = 'DEGRADED';
    }

    return {
      status,
      state,
      uptimeSeconds: snapshot.uptimeSeconds,
      activeRequests: this.lifecycle.getActiveRequests(),
      totalRequests: snapshot.totalRequests,
      activeSessions: this.sessionManager ? this.sessionManager.getActiveSessionCount() : 1,
      toolCount,
    };
  }
}
