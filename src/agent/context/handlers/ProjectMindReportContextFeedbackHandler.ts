import type { IAgentToolHandler } from '../../protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../protocol/models/AgentTool.js';
import type { ToolRequest } from '../../protocol/models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IAgentContextSessionManager } from '../interfaces/IAgentContextSessionManager.js';
import type { ContextFeedbackRating } from '../models/ContextFeedback.js';
import { CANONICAL_TOOLS } from '../../protocol/registry/ToolManifest.js';

export class ProjectMindReportContextFeedbackHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_report_context_feedback';

  constructor(private readonly contextSessionManager: IAgentContextSessionManager) {}

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
    const contextSessionId = String(args['contextSessionId']);
    const rating = String(args['rating']) as ContextFeedbackRating;
    const missingFeatures = Array.isArray(args['missingFeatures']) ? (args['missingFeatures'] as string[]) : undefined;
    const missingResources = Array.isArray(args['missingResources']) ? (args['missingResources'] as string[]) : undefined;
    const unnecessaryResources = Array.isArray(args['unnecessaryResources']) ? (args['unnecessaryResources'] as string[]) : undefined;
    const missingSections = Array.isArray(args['missingSections']) ? (args['missingSections'] as string[]) : undefined;
    const comments = args['comments'] ? String(args['comments']) : undefined;

    const feedback = await this.contextSessionManager.recordFeedback(
      {
        contextSessionId,
        rating,
        missingFeatures,
        missingResources,
        unnecessaryResources,
        missingSections,
        comments,
      },
      {
        workspaceId: request.workspaceId,
        repositoryId: request.repositoryId,
        agentSessionId: session?.sessionId ?? request.sessionId,
      }
    );

    return {
      feedbackId: feedback.feedbackId,
      contextSessionId: feedback.contextSessionId,
      rating: feedback.rating,
      recorded: true,
      recordedAt: feedback.recordedAt.toISOString(),
    };
  }
}
