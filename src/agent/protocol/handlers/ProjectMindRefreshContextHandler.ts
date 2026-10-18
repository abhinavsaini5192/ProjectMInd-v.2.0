import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IContextOrchestrator } from '../../../context/interfaces/IContextOrchestrator.js';
import type { ContextRequest } from '../../../context/models/ContextRequest.js';
import type { IAgentContextSessionManager } from '../../context/interfaces/IAgentContextSessionManager.js';
import { CANONICAL_TOOLS } from '../registry/ToolManifest.js';

export class ProjectMindRefreshContextHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_refresh_context';

  constructor(
    private readonly contextOrchestrator: IContextOrchestrator,
    private readonly contextSessionManager?: IAgentContextSessionManager | undefined
  ) {}

  public getToolDefinition(): AgentTool {
    const tool = CANONICAL_TOOLS.find((t) => t.name === this.toolName);
    if (!tool) throw new Error(`Definition for tool '${this.toolName}' not found`);
    return tool;
  }

  public async execute(
    request: ToolRequest,
    _session?: AgentSession | undefined
  ): Promise<Record<string, unknown>> {
    const args = request.arguments;
    const packageId = String(args['packageId']);
    const modifiedFiles = Array.isArray(args['modifiedFiles'])
      ? (args['modifiedFiles'] as string[])
      : [];

    const contextSessionId = args['contextSessionId'] ? String(args['contextSessionId']) : undefined;

    if (contextSessionId && this.contextSessionManager) {
      const result = await this.contextSessionManager.refreshContextSession(
        contextSessionId,
        {
          modifiedFiles,
          reason: 'EXPLICIT_REQUEST',
        },
        {
          workspaceId: request.workspaceId,
          repositoryId: request.repositoryId,
          agentSessionId: _session?.sessionId ?? request.sessionId,
        }
      );

      return {
        packageId: result.package.packageId,
        refreshed: true,
        changes: modifiedFiles,
        newTokens: result.package.estimatedTokens,
        contextSessionId,
        refreshedVersion: result.refreshedVersion,
      };
    }

    const contextRequest: ContextRequest = {
      requestId: request.requestId,
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      taskText: `Refresh context package ${packageId}`,
      resourceIds: modifiedFiles.length > 0 ? modifiedFiles : undefined,
      changedResources: modifiedFiles.length > 0 ? modifiedFiles : undefined,
      freshnessPolicy: 'CURRENT',
    };

    const refreshedPackage = await this.contextOrchestrator.orchestrateContext(contextRequest);

    return {
      packageId: refreshedPackage?.package?.packageId ?? packageId,
      refreshed: true,
      changes: modifiedFiles,
      newTokens: refreshedPackage?.package?.estimatedTokens,
    };
  }
}
