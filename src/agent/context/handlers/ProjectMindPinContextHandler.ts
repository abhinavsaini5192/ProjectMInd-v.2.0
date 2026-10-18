import type { IAgentToolHandler } from '../../protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IAgentContextSessionManager } from '../interfaces/IAgentContextSessionManager.js';
import type { ContextPinType } from '../models/ContextPin.js';
import { CANONICAL_TOOLS } from '../../protocol/registry/ToolManifest.js';

export class ProjectMindPinContextHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_pin_context';

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
    const type = String(args['type']) as ContextPinType;
    const targetId = String(args['targetId']);
    const reason = args['reason'] ? String(args['reason']) : undefined;

    const pin = await this.contextSessionManager.pinContext(
      contextSessionId,
      {
        type,
        targetId,
        reason,
        pinnedBy: session?.sessionId ?? request.sessionId,
      },
      {
        workspaceId: request.workspaceId,
        repositoryId: request.repositoryId,
        agentSessionId: session?.sessionId ?? request.sessionId,
      }
    );

    return {
      contextSessionId,
      pinId: pin.pinId,
      type: pin.type,
      targetId: pin.targetId,
      pinnedAt: pin.pinnedAt.toISOString(),
      pinned: true,
    };
  }
}
