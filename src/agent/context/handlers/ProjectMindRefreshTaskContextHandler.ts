import type { IAgentToolHandler } from '../../protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IAgentContextSessionManager } from '../interfaces/IAgentContextSessionManager.js';
import type { ContextRefreshReason } from '../models/ContextRefreshReason.js';
import { CANONICAL_TOOLS } from '../../protocol/registry/ToolManifest.js';

export class ProjectMindRefreshTaskContextHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_refresh_task_context';

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
    const reason = typeof args['reason'] === 'string' ? (args['reason'] as ContextRefreshReason) : 'EXPLICIT_REQUEST';
    const modifiedFiles = Array.isArray(args['modifiedFiles']) ? (args['modifiedFiles'] as string[]) : undefined;
    const affectedFeatures = Array.isArray(args['affectedFeatures']) ? (args['affectedFeatures'] as string[]) : undefined;
    const staleSections = Array.isArray(args['staleSections']) ? (args['staleSections'] as string[]) : undefined;
    const tokenBudget = typeof args['tokenBudget'] === 'number' ? args['tokenBudget'] : undefined;
    const forceFullRefresh = typeof args['forceFullRefresh'] === 'boolean' ? args['forceFullRefresh'] : false;

    const result = await this.contextSessionManager.refreshContextSession(
      contextSessionId,
      {
        reason,
        modifiedFiles,
        affectedFeatures,
        staleSections,
        tokenBudget,
        forceFullRefresh,
      },
      {
        workspaceId: request.workspaceId,
        repositoryId: request.repositoryId,
        agentSessionId: session?.sessionId ?? request.sessionId,
      }
    );

    return {
      contextSessionId,
      packageId: result.package.packageId,
      refreshedVersion: result.refreshedVersion,
      previousVersion: result.previousVersion,
      reason: result.reason,
      reusedSections: result.reusedSections,
      rebuiltSections: result.rebuiltSections,
      affectedFeatures: result.affectedFeatures,
      durationMs: result.durationMs,
      estimatedTokens: result.package.estimatedTokens,
    };
  }
}
