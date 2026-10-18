import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IContextOrchestrator } from '../../../context/interfaces/IContextOrchestrator.js';
import type { ContextRequest } from '../../../context/models/ContextRequest.js';
import { CANONICAL_TOOLS } from '../registry/ToolManifest.js';

export class ProjectMindGetFeatureContextHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_feature_context';

  constructor(private readonly contextOrchestrator: IContextOrchestrator) {}

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
    const featureId = String(args['featureId']);
    const tokenBudget = typeof args['tokenBudget'] === 'number' ? args['tokenBudget'] : 8000;
    const includeRelatedFeatures = args['includeRelatedFeatures'] !== undefined
      ? Boolean(args['includeRelatedFeatures'])
      : true;

    const contextRequest: ContextRequest = {
      requestId: request.requestId,
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      taskText: `Feature context for ${featureId}`,
      featureIds: [featureId],
      tokenBudget,
      includeDependencies: includeRelatedFeatures,
    };

    const response = await this.contextOrchestrator.getFeatureContextForTask(contextRequest);

    return {
      featureId,
      packageId: response.package.packageId,
      resources: response.package.resources,
      tokensUsed: response.package.estimatedTokens,
      confidence: response.package.completeness?.score ?? 1.0,
    };
  }
}
