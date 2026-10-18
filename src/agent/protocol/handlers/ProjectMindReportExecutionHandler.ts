import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import type { IAgentContextSessionManager } from '../../context/interfaces/IAgentContextSessionManager.js';
import { CANONICAL_TOOLS } from '../registry/ToolManifest.js';

import type { ITaskRuntime } from '../../runtime/interfaces/ITaskRuntime.js';
import type { IObservationProcessor } from '../../observation/interfaces/IObservationProcessor.js';

export class ProjectMindReportExecutionHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_report_execution';

  constructor(
    private readonly eventBus?: IEventBus | undefined,
    private readonly contextSessionManager?: IAgentContextSessionManager | undefined,
    private readonly taskRuntime?: ITaskRuntime | undefined,
    private readonly observationProcessor?: IObservationProcessor | undefined
  ) {}

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
    const status = String(args['status']);
    const summary = String(args['summary']);
    const modifiedFiles = Array.isArray(args['modifiedFiles'])
      ? (args['modifiedFiles'] as string[])
      : [];
    const operationId = args['operationId'] ? String(args['operationId']) : undefined;
    const contextSessionId = args['contextSessionId'] ? String(args['contextSessionId']) : undefined;
    const agentSessionId = session?.sessionId ?? request.sessionId ?? 'default-session';

    if (this.observationProcessor) {
      const obsResult = await this.observationProcessor.processExecutionReport(
        {
          taskId,
          contextSessionId,
          status,
          summary,
          modifiedFiles,
          operationId,
        },
        {
          workspaceId: request.workspaceId,
          repositoryId: request.repositoryId,
          agentSessionId,
        }
      );

      return {
        taskId,
        status,
        acknowledged: true,
        recordedAt: new Date().toISOString(),
        filesCount: modifiedFiles.length,
        contextSessionId,
        invalidationDecision: obsResult.invalidationDecision,
        observationsCount: obsResult.observations.length,
      };
    }

    if (this.taskRuntime) {
      const runtimeResult = await this.taskRuntime.reportExecution(
        {
          taskId,
          contextSessionId,
          status: status as any,
          summary,
          modifiedFiles,
          operationId,
        },
        {
          workspaceId: request.workspaceId,
          repositoryId: request.repositoryId,
          agentSessionId,
        }
      );

      return {
        taskId,
        status,
        acknowledged: runtimeResult.acknowledged,
        recordedAt: runtimeResult.recordedAt,
        filesCount: modifiedFiles.length,
        contextSessionId,
        invalidationDecision: runtimeResult.invalidationDecision,
      };
    }

    let invalidationDecision: string | undefined;
    if (contextSessionId && this.contextSessionManager) {
      try {
        const reportResult = await this.contextSessionManager.reportExecution(
          {
            taskId,
            contextSessionId,
            status: status as any,
            summary,
            modifiedFiles,
          },
          {
            workspaceId: request.workspaceId,
            repositoryId: request.repositoryId,
            agentSessionId,
          }
        );
        invalidationDecision = reportResult.invalidation.decision;
      } catch {
        // Continue with baseline reporting if context session lookup fails
      }
    }

    const recordedAt = new Date().toISOString();
    const eventPayload = {
      taskId,
      status,
      summary,
      modifiedFiles,
      operationId,
      contextSessionId,
      agentId: request.agentId,
      sessionId: session?.sessionId ?? request.sessionId,
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      timestamp: recordedAt,
    };

    this.eventBus?.publish('agent.execution.reported', eventPayload);

    return {
      taskId,
      status,
      acknowledged: true,
      recordedAt,
      filesCount: modifiedFiles.length,
      contextSessionId,
      invalidationDecision,
    };
  }
}
