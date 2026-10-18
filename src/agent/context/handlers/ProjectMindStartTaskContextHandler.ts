import type { IAgentToolHandler } from '../../protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IAgentContextSessionManager } from '../interfaces/IAgentContextSessionManager.js';
import { CANONICAL_TOOLS } from '../../protocol/registry/ToolManifest.js';

export class ProjectMindStartTaskContextHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_start_task_context';

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
    const taskText = String(args['taskText']);
    const taskId = args['taskId'] ? String(args['taskId']) : undefined;
    const taskTitle = args['taskTitle'] ? String(args['taskTitle']) : undefined;
    const taskIntent = args['taskIntent'] ? String(args['taskIntent']) : undefined;
    const featureIds = Array.isArray(args['featureIds']) ? (args['featureIds'] as string[]) : undefined;
    const resourceIds = Array.isArray(args['resourceIds']) ? (args['resourceIds'] as string[]) : undefined;
    const changedResources = Array.isArray(args['changedResources']) ? (args['changedResources'] as string[]) : undefined;
    const tokenBudget = typeof args['tokenBudget'] === 'number' ? args['tokenBudget'] : undefined;
    const requestedSections = Array.isArray(args['requestedSections']) ? (args['requestedSections'] as string[]) : undefined;
    const freshnessPolicy = typeof args['freshnessPolicy'] === 'string' ? (args['freshnessPolicy'] as any) : undefined;
    const compactMode = typeof args['compactMode'] === 'boolean' ? args['compactMode'] : undefined;

    const agentSessionId = session?.sessionId ?? request.sessionId ?? 'default-session';

    const result = await this.contextSessionManager.startTaskContext({
      agentSessionId,
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      taskText,
      taskId,
      taskTitle,
      taskIntent,
      featureIds,
      resourceIds,
      changedResources,
      tokenBudget,
      requestedSections,
      freshnessPolicy,
      compactMode,
    });

    return {
      task: result.task,
      contextSession: result.contextSession,
      contextPackage: result.contextPackage,
      warnings: result.warnings,
      freshness: result.freshness,
      versionMetadata: result.versionMetadata,
    };
  }
}
