import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IFeatureKnowledgeAPI } from '../../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import { CANONICAL_TOOLS } from '../registry/ToolManifest.js';

export class ProjectMindGetHealthHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_health';

  constructor(private readonly featureKnowledgeApi: IFeatureKnowledgeAPI) {}

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

    const healthSection = await this.featureKnowledgeApi.getFeatureHealth(featureId);

    return {
      featureId,
      healthScore: healthSection?.data?.healthScore ?? 1.0,
      stability: healthSection?.data?.healthStatus ?? 'STABLE',
      riskFactors: healthSection?.data?.risks ?? [],
      criticalityScore: healthSection?.data?.criticalityScore ?? 0,
      raw: healthSection,
    };
  }
}
