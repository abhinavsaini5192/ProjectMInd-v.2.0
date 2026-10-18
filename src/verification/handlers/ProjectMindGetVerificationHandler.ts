import type { IAgentToolHandler } from '../../agent/protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../agent/protocol/models/AgentTool.js';
import type { ToolRequest } from '../../agent/protocol/models/ToolRequest.js';
import type { AgentSession } from '../../agent/models/AgentSession.js';
import { CANONICAL_TOOLS } from '../../agent/protocol/registry/ToolManifest.js';
import type { IVerificationQueryService } from '../interfaces/IVerificationQueryService.js';

export class ProjectMindGetVerificationHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_verification';

  constructor(private readonly queryService: IVerificationQueryService) {}

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
    const verificationId = args['verificationId'] ? String(args['verificationId']) : undefined;

    if (verificationId) {
      const record = await this.queryService.getVerification(verificationId);
      return {
        records: record ? [record] : [],
        total: record ? 1 : 0,
      };
    }

    const taskId = args['taskId'] ? String(args['taskId']) : undefined;
    const verificationType = args['verificationType'] ? (String(args['verificationType']) as any) : undefined;
    const resourcePath = args['resourcePath'] ? String(args['resourcePath']) : undefined;
    const featureId = args['featureId'] ? String(args['featureId']) : undefined;
    const limit = typeof args['limit'] === 'number' ? args['limit'] : 50;

    const records = await this.queryService.getVerifications({
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      taskId,
      verificationType,
      resourceId: resourcePath,
      featureId,
      limit,
    });

    return {
      records,
      total: records.length,
    };
  }
}
