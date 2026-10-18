import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IContextOrchestrator } from '../../../context/interfaces/IContextOrchestrator.js';
import type { ContextRequest } from '../../../context/models/ContextRequest.js';
import { CANONICAL_TOOLS } from '../registry/ToolManifest.js';

export class ProjectMindExplainContextHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_explain_context';

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
    const packageId = String(args['packageId']);

    const contextRequest: ContextRequest = {
      requestId: request.requestId,
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      taskText: `Explain context package ${packageId}`,
      explainSelection: true,
    };

    const explanation = await this.contextOrchestrator.getContextExplanation(contextRequest);

    return {
      packageId,
      reasons: explanation?.detailedExplanations ?? [],
      scoringBreakdown: explanation?.featureSelectionReasons ?? {},
      explanation,
    };
  }
}
