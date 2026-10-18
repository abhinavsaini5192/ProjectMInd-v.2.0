import type { IAgentToolHandler } from '../../agent/protocol/interfaces/IAgentToolHandler.js';
import type { AgentTool } from '../../agent/protocol/models/AgentTool.js';
import type { ToolRequest } from '../../agent/protocol/models/ToolRequest.js';
import type { AgentSession } from '../../agent/models/AgentSession.js';
import { CANONICAL_TOOLS } from '../../agent/protocol/registry/ToolManifest.js';
import type { IVerificationQueryService } from '../interfaces/IVerificationQueryService.js';
import type { VerificationPolicy } from '../policies/VerificationPolicy.js';

export class ProjectMindGetCompletionEvidenceHandler implements IAgentToolHandler {
  public readonly toolName = 'projectmind_get_completion_evidence';

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
    const requireTrusted = typeof args['requireTrusted'] === 'boolean' ? args['requireTrusted'] : undefined;

    const policy: VerificationPolicy | undefined = requireTrusted !== undefined
      ? { requireTrustedVerification: requireTrusted }
      : undefined;

    const evidence = await this.queryService.getCompletionEvidence(taskId, policy);

    return {
      taskId: evidence.taskId,
      canComplete: evidence.canComplete,
      status: evidence.status,
      requiredConditions: evidence.requiredConditions,
      actualEvidence: evidence.actualEvidence,
      missingConditions: evidence.missingConditions,
      reasons: evidence.reasons,
      confidence: evidence.confidence,
      hasConflictingEvidence: evidence.hasConflictingEvidence,
      hasStaleEvidence: evidence.hasStaleEvidence,
      evaluatedAt: evidence.evaluatedAt,
    };
  }
}
