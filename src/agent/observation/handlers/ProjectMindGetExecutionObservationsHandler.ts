import type { IAgentToolHandler } from '../../protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import { CANONICAL_TOOLS } from '../../protocol/registry/ToolManifest.js';
import type { IObservationQueryService } from '../interfaces/IObservationQueryService.js';
import type { ObservationType } from '../models/ObservationType.js';
import type { ObservationSource } from '../models/ObservationSource.js';

export class ProjectMindGetExecutionObservationsHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_execution_observations';

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
    const type = args['type'] ? (String(args['type']) as ObservationType) : undefined;
    const source = args['source'] ? (String(args['source']) as ObservationSource) : undefined;
    const limit = typeof args['limit'] === 'number' ? args['limit'] : 50;
    const offset = typeof args['offset'] === 'number' ? args['offset'] : 0;

    const scope = {
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      agentSessionId: session?.sessionId ?? request.sessionId,
      taskId,
    };

    const paginated = await this.queryService.getObservations(
      {
        workspaceId: request.workspaceId,
        repositoryId: request.repositoryId,
        taskId,
        type,
        source,
        limit,
        offset,
      },
      scope
    );

    return {
      taskId,
      observations: paginated.observations,
      totalCount: paginated.totalCount,
      totalObservations: paginated.totalObservations ?? paginated.totalCount,
      limit: paginated.limit,
      offset: paginated.offset,
      hasMore: paginated.hasMore,
    };
  }
}
