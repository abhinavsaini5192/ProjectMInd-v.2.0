import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IFeatureKnowledgeAPI } from '../../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import type { FeatureKnowledgeOptions } from '../../../knowledge/features/api/models/FeatureKnowledgeOptions.js';
import { CANONICAL_TOOLS } from '../registry/ToolManifest.js';

export class ProjectMindGetFeatureHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_feature';

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
    const includeDependencies = Boolean(args['includeDependencies']);
    const includeMappings = Boolean(args['includeMappings']);
    const includeHealth = Boolean(args['includeHealth']);

    const options: FeatureKnowledgeOptions = {
      includeDependencies,
      includeHealth,
      includeReferences: includeMappings,
    };

    const profile = await this.featureKnowledgeApi.getFeatureProfile(featureId, options);

    return {
      found: profile ? true : false,
      feature: profile,
    };
  }
}
