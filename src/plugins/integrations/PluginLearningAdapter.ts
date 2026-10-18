import type { IPluginService } from '../interfaces/IPluginService.js';
import type { IFeedbackCollector } from '../../intelligence/learning/interfaces/IFeedbackCollector.js';
import type { FeedbackType } from '../../intelligence/learning/models/FeedbackType.js';
import type { FeedbackSignal } from '../../intelligence/learning/models/FeedbackSignal.js';
import { PluginSecurityError } from '../errors/PluginError.js';

export interface PluginFeedbackSubmission {
  readonly pluginId: string;
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly feedbackType: FeedbackType;
  readonly targetType: string;
  readonly targetId: string;
  readonly signal: FeedbackSignal;
  readonly value: number;
  readonly commentary?: string | undefined;
}

export class PluginLearningAdapter {
  constructor(
    private readonly pluginService: IPluginService,
    private readonly feedbackCollector?: IFeedbackCollector
  ) {}

  public async submitPluginFeedback(submission: PluginFeedbackSubmission): Promise<string | undefined> {
    // 1. Verify plugin is authorized to submit feedback
    const grants = await this.pluginService.getGrants(submission.workspaceId, submission.projectId);
    const pluginGrant = grants.find((g) => g.pluginId === submission.pluginId && g.status === 'ACTIVE');

    if (!pluginGrant || !pluginGrant.grantedCapabilities.includes('SUBMIT_FEEDBACK')) {
      throw new PluginSecurityError(
        submission.pluginId,
        `Plugin '${submission.pluginId}' does not have 'SUBMIT_FEEDBACK' capability granted in workspace '${submission.workspaceId}'.`,
        ['SUBMIT_FEEDBACK']
      );
    }

    if (!this.feedbackCollector) {
      return undefined;
    }

    // 2. Submit to Phase 9.7 FeedbackCollector with strict non-escalated authority
    const feedback = await this.feedbackCollector.recordFeedback({
      workspaceId: submission.workspaceId,
      projectId: submission.projectId ?? 'proj-default',
      sourceType: 'AGENT', // Enforce AGENT source type to prevent privilege escalation
      sourceId: `plugin:${submission.pluginId}`,
      feedbackType: submission.feedbackType,
      targetType: submission.targetType,
      targetId: submission.targetId,
      signal: submission.signal,
      value: Math.max(0, Math.min(1, submission.value)),
      confidence: 0.60, // Plugin confidence is bounded
      metadata: {
        commentary: submission.commentary ? `[Plugin:${submission.pluginId}] ${submission.commentary}` : undefined,
      },
      provenance: {
        origin: `plugin:${submission.pluginId}`,
        isExplicit: true,
        authority: 'AGENT_REPORTED',
        actorId: `plugin:${submission.pluginId}`,
        actorRole: 'PLUGIN',
      },
      scope: {
        level: 'PROJECT',
        value: submission.projectId ?? 'proj-default',
        workspaceId: submission.workspaceId,
        projectId: submission.projectId ?? 'proj-default',
      },
    });

    return feedback.id;
  }
}
