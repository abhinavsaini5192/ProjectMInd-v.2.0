import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IContextOrchestrator } from '../../../context/interfaces/IContextOrchestrator.js';
import type { ContextRequest } from '../../../context/models/ContextRequest.js';
import { CANONICAL_TOOLS } from '../registry/ToolManifest.js';

export class ProjectMindGetContextHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_context';

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
    const taskId = String(args['taskId']);
    const featureId = args['featureId'] ? String(args['featureId']) : undefined;
    const targetFiles = Array.isArray(args['targetFiles'])
      ? (args['targetFiles'] as string[])
      : undefined;
    const tokenBudget = typeof args['tokenBudget'] === 'number' ? args['tokenBudget'] : 8000;
    const depth = typeof args['depth'] === 'string' ? (args['depth'] as any) : 'L1';
    const intent = typeof args['intent'] === 'string' ? (args['intent'] as any) : 'IMPLEMENTATION';

    const contextRequest: ContextRequest = {
      requestId: request.requestId,
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      taskText: taskId,
      featureIds: featureId ? [featureId] : undefined,
      resourceIds: targetFiles,
      tokenBudget,
    };

    const response = await this.contextOrchestrator.orchestrateContext(contextRequest);

    return {
      taskId,
      packageId: response.package.packageId,
      tokensUsed: response.package.estimatedTokens,
      confidence: response.package.completeness?.score ?? 1.0,
      resources: response.package.resources,
      plan: response.plan,
    };
  }
}
