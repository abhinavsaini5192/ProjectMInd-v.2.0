import type { IAgentToolHandler } from '../../protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import { CANONICAL_TOOLS } from '../../protocol/registry/ToolManifest.js';
import type { IObservationQueryService } from '../interfaces/IObservationQueryService.js';

export class ProjectMindGetTaskTimelineHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_task_timeline';

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

    const timeline = await this.queryService.getObservationTimeline(taskId, scope);

    return {
      taskId: timeline.taskId,
      entries: timeline.entries,
      totalEntries: timeline.totalEntries,
      totalObservations: timeline.totalObservations ?? timeline.totalEntries,
      firstObservedAt: timeline.firstObservedAt,
      lastObservedAt: timeline.lastObservedAt,
    };
  }
}
