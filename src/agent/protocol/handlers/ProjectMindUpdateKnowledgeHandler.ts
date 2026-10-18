import type { IAgentToolHandler } from '../interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../models/AgentTool.js';
import type { ToolRequest } from '../models/ToolRequest.js';
import type { AgentSession } from '../../models/AgentSession.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import type { IKnowledgeUpdateCoordinator } from '../../../knowledge/update/interfaces/IKnowledgeUpdateCoordinator.js';
import type { KnowledgeUpdateType } from '../../../knowledge/update/models/KnowledgeUpdateType.js';
import { CANONICAL_TOOLS } from '../registry/ToolManifest.js';

export class ProjectMindUpdateKnowledgeHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_update_knowledge';

  constructor(
    private readonly eventBus?: IEventBus | undefined,
    private readonly coordinator?: IKnowledgeUpdateCoordinator | undefined
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
    const featureId = String(args['featureId']);
    const insights = Array.isArray(args['insights']) ? (args['insights'] as string[]) : [];
    const confidence = typeof args['confidence'] === 'number' ? args['confidence'] : 0.8;
    const operationId = args['operationId'] ? String(args['operationId']) : undefined;
    const updateType = (args['updateType'] as KnowledgeUpdateType) || 'FEATURE_MAPPING_CHANGED';
    const affectedResources = Array.isArray(args['affectedResources'])
      ? (args['affectedResources'] as string[])
      : [];

    const recordedAt = new Date().toISOString();
    const eventPayload = {
      featureId,
      insights,
      confidence,
      operationId,
      agentId: request.agentId,
      sessionId: session?.sessionId ?? request.sessionId,
      workspaceId: request.workspaceId,
      repositoryId: request.repositoryId,
      timestamp: recordedAt,
    };

    let updateResultMetadata: Record<string, unknown> = {};

    // Route into Knowledge Update Loop if coordinator is available
    if (this.coordinator) {
      try {
        const updateResult = await this.coordinator.processKnowledgeUpdate({
          repositoryId: request.repositoryId,
          workspaceId: request.workspaceId,
          taskId: (session as any)?.taskId ?? (args['taskId'] as string | undefined),
          agentSessionId: session?.sessionId ?? request.sessionId,
          source: 'AGENT' as any,
          provenance: 'AGENT_REPORTED',
          updateType,
          affectedFeatures: [featureId],
          affectedResources,
          confidence,
          idempotencyKey: operationId,
          metadata: {
            insights,
            operationId,
            agentId: request.agentId,
          },
        });

        updateResultMetadata = {
          updateId: updateResult.updateId,
          knowledgeVersion: updateResult.newKnowledgeVersion,
          status: updateResult.status,
          appliedAreas: updateResult.appliedAreas,
          invalidationsCount: updateResult.invalidations.length,
        };
      } catch (err: any) {
        // Log error and proceed with event publication
        updateResultMetadata = {
          updateError: err.message || String(err),
        };
      }
    }

    this.eventBus?.publish('agent.knowledge.updated', eventPayload);

    return {
      featureId,
      stored: true,
      insightsRecorded: insights.length,
      confidence,
      recordedAt,
      ...updateResultMetadata,
    };
  }
}
