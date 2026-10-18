import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { CANONICAL_TOOLS } from '../registry/ToolManifest.js';

import type { ITaskRuntime } from '../../runtime/interfaces/ITaskRuntime.js';
import type { IObservationProcessor } from '../../observation/interfaces/IObservationProcessor.js';
import type { IVerificationProcessor } from '../../../verification/interfaces/IVerificationProcessor.js';

export class ProjectMindReportVerificationHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_report_verification';

  constructor(
    private readonly eventBus?: IEventBus | undefined,
    private readonly taskRuntime?: ITaskRuntime | undefined,
    private readonly observationProcessor?: IObservationProcessor | undefined,
    private readonly verificationProcessor?: IVerificationProcessor | undefined
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
    const passed = Boolean(args['passed']);
    const summary = String(args['summary']);
    const testResults = Array.isArray(args['testResults']) ? (args['testResults'] as Record<string, unknown>[]) : [];
    const diagnostics = Array.isArray(args['diagnostics'])
      ? (args['diagnostics'] as string[])
      : [];
    const operationId = args['operationId'] ? String(args['operationId']) : undefined;
    const agentSessionId = session?.sessionId ?? request.sessionId ?? 'default-session';

    if (this.verificationProcessor) {
      const vResult = await this.verificationProcessor.processVerification(
        {
          taskId,
          passed,
          summary,
          testResults,
          diagnostics,
          operationId,
          source: 'AGENT',
        },
        {
          workspaceId: request.workspaceId,
          repositoryId: request.repositoryId,
          agentSessionId,
          taskId,
        }
      );

      return {
        taskId,
        passed,
        recorded: true,
        status: vResult.record.status,
        verificationId: vResult.record.verificationId,
        provenance: vResult.record.provenance.verificationLevel,
        recordedAt: vResult.record.receivedAt,
        diagnosticsCount: diagnostics.length,
        conflictsCount: vResult.conflicts.length,
      };
    }

    if (this.observationProcessor) {

      const obsResult = await this.observationProcessor.processVerificationReport(
        {
          taskId,
          passed,
          summary,
          testResults,
          diagnostics,
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
        passed,
        recorded: true,
        status: passed ? 'PASSED' : 'FAILED',
        recordedAt: new Date().toISOString(),
        diagnosticsCount: diagnostics.length,
        conflictsCount: obsResult.conflicts.length,
      };
    }

    if (this.taskRuntime) {
      const runtimeResult = await this.taskRuntime.reportVerification(
        {
          taskId,
          passed,
          summary,
          testResults,
          diagnostics,
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
        passed,
        recorded: runtimeResult.recorded,
        status: runtimeResult.status,
        recordedAt: runtimeResult.recordedAt,
        diagnosticsCount: diagnostics.length,
      };
    }

    const recordedAt = new Date().toISOString();
    const eventPayload = {
      taskId,
      passed,
      summary,
      testResults,
      diagnostics,
      operationId,
      agentId: request.agentId,
      sessionId: session?.sessionId ?? request.sessionId,
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      timestamp: recordedAt,
    };

    this.eventBus?.publish('agent.verification.reported', eventPayload);

    return {
      taskId,
      passed,
      recorded: true,
      recordedAt,
      diagnosticsCount: diagnostics.length,
    };
  }
}
