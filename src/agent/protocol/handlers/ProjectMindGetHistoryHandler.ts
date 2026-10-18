import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IFeatureKnowledgeAPI } from '../../../knowledge/features/api/interfaces/IFeatureKnowledgeAPI.js';
import { CANONICAL_TOOLS } from '../registry/ToolManifest.js';

export class ProjectMindGetHistoryHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_history';

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
    const limit = typeof args['limit'] === 'number' ? args['limit'] : 20;
    const sinceTimestamp = args['sinceTimestamp'] ? String(args['sinceTimestamp']) : undefined;

    const historySection = await this.featureKnowledgeApi.getFeatureHistory(featureId, {
      maxItemsPerSection: limit,
    });

    const timeline = (historySection?.data?.milestones ?? []) as unknown[];

    return {
      featureId,
      timeline,
      totalEvents: historySection?.data?.milestones?.length ?? 0,
      versionCount: historySection?.data?.versionCount,
      maturityLevel: historySection?.data?.maturityLevel,
    };
  }
}
