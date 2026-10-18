import type { IAgentToolHandler } from '../../agent/protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../agent/protocol/models/AgentTool.js';
import type { ToolRequest } from '../../agent/protocol/models/ToolRequest.js';
import type { AgentSession } from '../../agent/models/AgentSession.js';
import { CANONICAL_TOOLS } from '../../agent/protocol/registry/ToolManifest.js';
import type { IVerificationQueryService } from '../interfaces/IVerificationQueryService.js';

export class ProjectMindGetVerificationConflictsHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_verification_conflicts';

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
    const taskId = args['taskId'] ? String(args['taskId']) : undefined;

    const conflicts = await this.queryService.getVerificationConflicts(taskId);
    const unresolvedCount = conflicts.filter((c) => c.resolutionStatus === 'UNRESOLVED').length;

    return {
      taskId: taskId ?? 'all',
      conflicts,
      totalConflicts: conflicts.length,
      unresolvedCount,
    };
  }
}
