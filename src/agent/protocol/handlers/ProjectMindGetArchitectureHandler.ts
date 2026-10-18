import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IFeatureKnowledgeAPI } from '../../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import { CANONICAL_TOOLS } from '../registry/ToolManifest.js';

export class ProjectMindGetArchitectureHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_architecture';

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
    const featureId = args['featureId'] ? String(args['featureId']) : 'root_architecture';
    const includeExternal = Boolean(args['includeExternal']);
    const maxDepth = typeof args['maxDepth'] === 'number' ? args['maxDepth'] : 3;

    const archSection = await this.featureKnowledgeApi.getFeatureArchitecture(featureId, {
      maxDepth,
    });

    return {
      featureId: args['featureId'] ? featureId : undefined,
      components: archSection?.data?.components ?? [],
      boundaries: archSection?.data?.layer ? [archSection.data.layer] : [],
      dependencies: archSection?.data?.patterns ?? [],
      raw: archSection,
    };
  }
}
