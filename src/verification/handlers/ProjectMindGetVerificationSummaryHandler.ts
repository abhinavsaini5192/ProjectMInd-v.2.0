import type { IAgentToolHandler } from '../../agent/protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../agent/protocol/models/AgentTool.js';
import type { ToolRequest } from '../../agent/protocol/models/ToolRequest.js';
import type { AgentSession } from '../../agent/models/AgentSession.js';
import { CANONICAL_TOOLS } from '../../agent/protocol/registry/ToolManifest.js';
import type { IVerificationQueryService } from '../interfaces/IVerificationQueryService.js';

export class ProjectMindGetVerificationSummaryHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_verification_summary';

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
    const taskId = String(args['taskId']);

    const summary = await this.queryService.getVerificationSummary(
      taskId,
      request.workspaceId,
      request.repositoryId
    );

    return {
      taskId: summary.taskId ?? taskId,
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      blocked: summary.blocked,
      unknown: summary.unknown,
      latestStatus: summary.latestStatus,
      trustedStatus: summary.trustedStatus,
      agentReportedStatus: summary.agentReportedStatus,
      conflicts: summary.conflicts,
      byType: summary.byType,
      freshness: summary.freshness,
      generatedAt: summary.generatedAt,
    };
  }
}
