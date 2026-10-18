import type { IAgentToolHandler } from '../../protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IAgentContextSessionManager } from '../interfaces/IAgentContextSessionManager.js';
import { CANONICAL_TOOLS } from '../../protocol/registry/ToolManifest.js';

export class ProjectMindGetCurrentContextHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_current_context';

  constructor(private readonly contextSessionManager: IAgentContextSessionManager) {}

  public getToolDefinition(): AgentTool {
    const tool = CANONICAL_TOOLS.find((t) => t.name === this.toolName);
    if (!tool) throw new Error(`Definition for tool '${this.toolName}' not found`);
    return tool;
  }

  public async execute(
    request: ToolRequest,
    session?: AgentSession | undefined
  ): Promise<Record<string, unknown>> {
    const args = request.arguments;
    const contextSessionId = String(args['contextSessionId']);
    const includeDelta = typeof args['includeDelta'] === 'boolean' ? args['includeDelta'] : false;
    const baseContextVersion = typeof args['baseContextVersion'] === 'number' ? args['baseContextVersion'] : undefined;
    const autoRefreshIfStale = typeof args['autoRefreshIfStale'] === 'boolean' ? args['autoRefreshIfStale'] : true;

    const result = await this.contextSessionManager.getCurrentContext(
      contextSessionId,
      {
        includeDelta,
        baseContextVersion,
        autoRefreshIfStale,
      },
      {
        workspaceId: request.workspaceId,
        repositoryId: request.repositoryId,
        agentSessionId: session?.sessionId ?? request.sessionId,
      }
    );

    return {
      contextSessionId: result.contextSession.contextSessionId,
      taskId: result.contextSession.taskId,
      contextVersion: result.contextVersion,
      freshness: result.freshness,
      wasRefreshed: result.wasRefreshed,
      contextPackage: result.contextPackage,
      delta: result.delta,
      warnings: result.warnings,
    };
  }
}
