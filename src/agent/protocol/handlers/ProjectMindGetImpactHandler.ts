import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IFeatureKnowledgeAPI } from '../../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import { ToolArgumentError } from '../errors/ToolArgumentError.js';
import { CANONICAL_TOOLS } from '../registry/ToolManifest.js';

export class ProjectMindGetImpactHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_impact';

  constructor(private readonly featureKnowledgeApi: IFeatureKnowledgeAPI) {}

  public getToolDefinition(): AgentTool {
    const tool = CANONICAL_TOOLS.find((t) => t.name === this.toolName);
    if (!tool) throw new Error(`Definition for tool '${this.toolName}' not found`);
    return tool;
  }

  public validate(request: ToolRequest): void {
    const args = request.arguments;
    const featureId = args['featureId'];
    const modifiedFiles = args['modifiedFiles'];

    if (!featureId && (!Array.isArray(modifiedFiles) || modifiedFiles.length === 0)) {
      throw new ToolArgumentError(
        "Tool 'projectmind_get_impact' requires either 'featureId' or non-empty 'modifiedFiles'",
        { toolName: this.toolName },
        request.requestId
      );
    }
  }

  public async execute(
    request: ToolRequest,
    _session?: AgentSession | undefined
  ): Promise<Record<string, unknown>> {
    const args = request.arguments;
    const featureId = args['featureId'] ? String(args['featureId']) : 'workspace_scope';
    const modifiedFiles = Array.isArray(args['modifiedFiles'])
      ? (args['modifiedFiles'] as string[])
      : undefined;
    const depth = typeof args['depth'] === 'number' ? args['depth'] : 2;

    const impactResult = await this.featureKnowledgeApi.getFeatureImpact(featureId, {
      maxDepth: depth,
    });

    const affectedFeatures = impactResult?.data?.impactedFeatures?.map((f) => f.targetId) ?? [];
    const affectedFiles = impactResult?.data?.impactedResources?.map((r) => r.targetId) ?? modifiedFiles ?? [];

    return {
      featureId,
      depth,
      impact: impactResult,
      affectedFeatures,
      affectedFiles,
    };
  }
}
