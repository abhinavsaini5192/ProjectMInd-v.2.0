import type { IAgentToolHandler } from '../../protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { ITaskRuntime } from '../interfaces/ITaskRuntime.js';
import { CANONICAL_TOOLS } from '../../protocol/registry/ToolManifest.js';

export class ProjectMindCancelTaskHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_cancel_task';

  constructor(private readonly taskRuntime: ITaskRuntime) {}

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
    const taskId = String(args['taskId']);
    const reason = String(args['reason']);
    const expectedVersion =
      typeof args['expectedVersion'] === 'number' ? args['expectedVersion'] : undefined;

    const agentSessionId = session?.sessionId ?? request.sessionId ?? 'default-session';

    const cancelledTask = await this.taskRuntime.cancelTask(
      {
        taskId,
        reason,
        expectedVersion,
      },
      {
        workspaceId: request.workspaceId,
        repositoryId: request.repositoryId,
        agentSessionId,
      }
    );

    return {
      task: cancelledTask,
      cancelled: true,
    };
  }
}
