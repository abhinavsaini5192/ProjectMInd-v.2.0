import type { IAgentToolHandler } from '../../protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import { CANONICAL_TOOLS } from '../../protocol/registry/ToolManifest.js';
import type { IObservationQueryService } from '../interfaces/IObservationQueryService.js';

export class ProjectMindGetExecutionSummaryHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_execution_summary';

  constructor(private readonly queryService: IObservationQueryService) {}

  public getToolDefinition(): AgentTool {
    const tool = CANONICAL_TOOLS.find((t) => t.name === this.toolName);
    if (!tool) throw new Error(`Definition for tool '${this.toolName}' not found`);
    return tool;
  }

  public async execute(
    request: ToolRequest,
    session?: AgentSession | undefined
  ): Promise<Record<string, unknown>> {
    const args = request.arguments;
    if (!args['taskId']) {
      throw new Error("Missing required argument 'taskId'");
    }
    const taskId = String(args['taskId']);

    const scope = {
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      agentSessionId: session?.sessionId ?? request.sessionId,
      taskId,
    };

    const summary = await this.queryService.getExecutionSummary(taskId, scope);

    return {
      taskId: summary.taskId,
      workspaceId: summary.workspaceId,
      repositoryId: summary.repositoryId,
      executionState: summary.executionState,
      changedResources: summary.changedResources,
      commandsReported: summary.commandsReported,
      verificationResults: summary.verificationResults,
      errors: summary.errors,
      blockers: summary.blockers,
      conflicts: summary.conflicts,
      contextInvalidations: summary.contextInvalidations,
      latestObservation: summary.latestObservation,
      provenanceSummary: summary.provenanceSummary,
      generatedAt: summary.generatedAt,
      totalObservations:
        summary.totalObservations ??
        (summary.changedResources.length + summary.commandsReported.length),
      summary,
    };
  }
}
