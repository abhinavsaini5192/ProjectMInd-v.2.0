import type { IAgentToolHandler } from '../../protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IAgentContextSessionManager } from '../interfaces/IAgentContextSessionManager.js';
import { CANONICAL_TOOLS } from '../../protocol/registry/ToolManifest.js';

export class ProjectMindUpdateTaskContextHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_update_task_context';

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
    const newTaskText = args['newTaskText'] ? String(args['newTaskText']) : undefined;
    const newIntent = args['newIntent'] ? String(args['newIntent']) : undefined;
    const newTitle = args['newTitle'] ? String(args['newTitle']) : undefined;
    const featureIds = Array.isArray(args['featureIds']) ? (args['featureIds'] as string[]) : undefined;
    const tokenBudget = typeof args['tokenBudget'] === 'number' ? args['tokenBudget'] : undefined;

    const result = await this.contextSessionManager.updateTaskContext(
      contextSessionId,
      {
        newTaskText,
        newIntent,
        newTitle,
        featureIds,
        tokenBudget,
      },
      {
        workspaceId: request.workspaceId,
        repositoryId: request.repositoryId,
        agentSessionId: session?.sessionId ?? request.sessionId,
      }
    );

    return {
      contextSessionId,
      taskId: result.contextSession.taskId,
      updatedContextVersion: result.contextVersion,
      freshness: result.freshness,
      packageId: result.contextPackage.packageId,
      delta: result.delta,
    };
  }
}
