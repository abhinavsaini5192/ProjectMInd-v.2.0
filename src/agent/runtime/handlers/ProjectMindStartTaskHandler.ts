import type { IAgentToolHandler } from '../../protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { ITaskRuntime } from '../interfaces/ITaskRuntime.js';
import { CANONICAL_TOOLS } from '../../protocol/registry/ToolManifest.js';

export class ProjectMindStartTaskHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_start_task';

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
    const title = String(args['title']);
    const description = String(args['description']);
    const taskId = args['taskId'] ? String(args['taskId']) : undefined;
    const intent = args['intent'] ? String(args['intent']) : undefined;
    const priority = args['priority'] ? (String(args['priority']) as any) : undefined;
    const featureIds = Array.isArray(args['featureIds']) ? (args['featureIds'] as string[]) : undefined;
    const resourceIds = Array.isArray(args['resourceIds']) ? (args['resourceIds'] as string[]) : undefined;
    const changedResources = Array.isArray(args['changedResources']) ? (args['changedResources'] as string[]) : undefined;
    const tokenBudget = typeof args['tokenBudget'] === 'number' ? args['tokenBudget'] : undefined;
    const leaseDurationMs = typeof args['leaseDurationMs'] === 'number' ? args['leaseDurationMs'] : undefined;

    const agentSessionId = session?.sessionId ?? request.sessionId ?? 'default-session';

    const result = await this.taskRuntime.startTask(
      {
        taskId,
        agentSessionId,
        workspaceId: request.workspaceId,
        repositoryId: request.repositoryId,
        title,
        description,
        intent,
        priority,
        featureIds,
        resourceIds,
        changedResources,
        tokenBudget,
        leaseDurationMs,
      },
      {
        workspaceId: request.workspaceId,
        repositoryId: request.repositoryId,
        agentSessionId,
      }
    );

    return {
      task: result.task,
      contextSession: result.contextSession,
      contextPackage: result.contextPackage,
      state: result.state,
      warnings: result.warnings,
      freshness: result.freshness,
      contextVersion: result.contextVersion,
    };
  }
}
