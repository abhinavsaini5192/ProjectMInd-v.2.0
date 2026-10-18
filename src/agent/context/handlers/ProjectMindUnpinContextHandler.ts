import type { IAgentToolHandler } from '../../protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IAgentContextSessionManager } from '../interfaces/IAgentContextSessionManager.js';
import { CANONICAL_TOOLS } from '../../protocol/registry/ToolManifest.js';

export class ProjectMindUnpinContextHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_unpin_context';

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
    const pinId = String(args['pinId']);

    const success = await this.contextSessionManager.unpinContext(contextSessionId, pinId, {
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      agentSessionId: session?.sessionId ?? request.sessionId,
    });

    return {
      contextSessionId,
      pinId,
      unpinned: success,
    };
  }
}
