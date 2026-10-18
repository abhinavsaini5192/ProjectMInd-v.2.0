import type {
  IFeedbackCollector,
  ContextFeedbackParams,
  RetrievalFeedbackParams,
  PlanningFeedbackParams,
  VerificationFeedbackParams,
  UserFeedbackParams,
} from '../interfaces/IFeedbackCollector.js';
import type { IFeedbackStore } from '../interfaces/IFeedbackStore.js';
import type { IFeedbackNormalizer } from '../interfaces/IFeedbackNormalizer.js';
import type { Feedback, RawFeedbackInput } from '../models/Feedback.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import { LearningEventNames } from '../events/LearningEvents.js';

export class FeedbackCollector implements IFeedbackCollector {
  constructor(
    private readonly store: IFeedbackStore,
    private readonly normalizer: IFeedbackNormalizer,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async recordFeedback(input: RawFeedbackInput): Promise<Feedback> {
    const normalized = await this.normalizer.normalize(input);

    // Deduplication check
    if (normalized.deduplicationKey) {
      const existing = await this.store.findDuplicate(normalized.deduplicationKey);
      if (existing) {
        // Return existing deduplicated feedback without bloating store
        return existing;
      }
    }

    await this.store.saveFeedback(normalized);

    if (this.eventBus) {
      this.eventBus.publish(LearningEventNames.FEEDBACK_RECEIVED, { feedback: normalized });
      this.eventBus.publish(LearningEventNames.FEEDBACK_NORMALIZED, { feedback: normalized });
    }

    return normalized;
  }

  public async recordContextFeedback(params: ContextFeedbackParams): Promise<Feedback[]> {
    const results: Feedback[] = [];

    // Useful resources
    if (params.usefulResourceIds) {
      for (const resId of params.usefulResourceIds) {
        const fb = await this.recordFeedback({
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          sourceType: 'CONTEXT',
          sourceId: params.actorId,
          feedbackType: 'CONTEXT_USEFUL',
          targetType: 'RESOURCE',
          targetId: resId,
          contextReference: params.contextId,
          taskReference: params.taskId,
          provenance: {
            isExplicit: false,
            actorId: params.actorId,
          },
          metadata: { contextId: params.contextId },
        });
        results.push(fb);
      }
    }

    // Irrelevant resources
    if (params.irrelevantResourceIds) {
      for (const resId of params.irrelevantResourceIds) {
        const fb = await this.recordFeedback({
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          sourceType: 'CONTEXT',
          sourceId: params.actorId,
          feedbackType: 'CONTEXT_IRRELEVANT',
          targetType: 'RESOURCE',
          targetId: resId,
          contextReference: params.contextId,
          taskReference: params.taskId,
          provenance: {
            isExplicit: false,
            actorId: params.actorId,
          },
          metadata: { contextId: params.contextId },
        });
        results.push(fb);
      }
    }

    // Missing resources
    if (params.missingResourceIds) {
      for (const resId of params.missingResourceIds) {
        const fb = await this.recordFeedback({
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          sourceType: 'CONTEXT',
          sourceId: params.actorId,
          feedbackType: 'CONTEXT_MISSING',
          targetType: 'RESOURCE',
          targetId: resId,
          contextReference: params.contextId,
          taskReference: params.taskId,
          provenance: {
            isExplicit: true,
            actorId: params.actorId,
          },
          metadata: { contextId: params.contextId },
        });
        results.push(fb);
      }
    }

    // Context size warning
    if (params.isTooLarge) {
      const fb = await this.recordFeedback({
        workspaceId: params.workspaceId,
        projectId: params.projectId,
        sourceType: 'CONTEXT',
        sourceId: params.actorId,
        feedbackType: 'CONTEXT_TOO_LARGE',
        targetType: 'CONTEXT_PACKAGE',
        targetId: params.contextId,
        contextReference: params.contextId,
        taskReference: params.taskId,
        provenance: {
          isExplicit: false,
          actorId: params.actorId,
        },
      });
      results.push(fb);
    }

    return results;
  }

  public async recordRetrievalFeedback(params: RetrievalFeedbackParams): Promise<Feedback[]> {
    const results: Feedback[] = [];

    if (params.relevantItemIds) {
      for (const id of params.relevantItemIds) {
        const fb = await this.recordFeedback({
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          sourceType: 'RETRIEVAL',
          sourceId: params.actorId,
          feedbackType: 'RETRIEVAL_RELEVANT',
          targetType: 'RESOURCE',
          targetId: id,
          taskReference: params.taskId,
          provenance: { isExplicit: false, actorId: params.actorId },
          metadata: { query: params.query },
        });
        results.push(fb);
      }
    }

    if (params.irrelevantItemIds) {
      for (const id of params.irrelevantItemIds) {
        const fb = await this.recordFeedback({
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          sourceType: 'RETRIEVAL',
          sourceId: params.actorId,
          feedbackType: 'RETRIEVAL_IRRELEVANT',
          targetType: 'RESOURCE',
          targetId: id,
          taskReference: params.taskId,
          provenance: { isExplicit: false, actorId: params.actorId },
          metadata: { query: params.query },
        });
        results.push(fb);
      }
    }

    if (params.missedItemIds) {
      for (const id of params.missedItemIds) {
        const fb = await this.recordFeedback({
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          sourceType: 'RETRIEVAL',
          sourceId: params.actorId,
          feedbackType: 'RETRIEVAL_MISSED',
          targetType: 'RESOURCE',
          targetId: id,
          taskReference: params.taskId,
          provenance: { isExplicit: true, actorId: params.actorId },
          metadata: { query: params.query },
        });
        results.push(fb);
      }
    }

    return results;
  }

  public async recordPlanningFeedback(params: PlanningFeedbackParams): Promise<Feedback> {
    const feedbackType =
      params.outcome === 'SUCCESS'
        ? 'PLAN_GOOD'
        : params.outcome === 'REPLANNED'
          ? 'PLAN_INCOMPLETE'
          : 'PLAN_BAD';

    return this.recordFeedback({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      sourceType: 'PLAN',
      sourceId: params.actorId,
      feedbackType,
      targetType: 'PLAN',
      targetId: params.planId,
      planReference: params.planId,
      taskReference: params.taskId,
      provenance: { isExplicit: false, actorId: params.actorId },
      metadata: { taskType: params.taskType, reason: params.reason },
    });
  }

  public async recordVerificationFeedback(params: VerificationFeedbackParams): Promise<Feedback> {
    return this.recordFeedback({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      sourceType: 'VERIFICATION',
      sourceId: params.actorId,
      feedbackType: params.passed ? 'VERIFICATION_SUFFICIENT' : 'VERIFICATION_INSUFFICIENT',
      targetType: 'VERIFICATION',
      targetId: params.verificationId,
      taskReference: params.taskId,
      provenance: {
        isExplicit: true,
        verificationId: params.verificationId,
        verificationPassed: params.passed,
        actorId: params.actorId,
      },
      evidenceReferences: params.targetResources ?? [],
      metadata: { notes: params.notes, passed: params.passed },
    });
  }

  public async recordUserFeedback(params: UserFeedbackParams): Promise<Feedback> {
    const feedbackType = params.correctionText
      ? 'USER_CORRECTION'
      : params.rating >= 3
        ? 'CONTEXT_USEFUL'
        : 'CONTEXT_IRRELEVANT';

    return this.recordFeedback({
      workspaceId: params.workspaceId,
      projectId: params.projectId,
      sourceType: 'USER',
      sourceId: params.userId,
      feedbackType,
      targetType: params.targetType,
      targetId: params.targetId,
      provenance: {
        isExplicit: true,
        actorId: params.userId,
        actorRole: 'USER',
      },
      metadata: {
        comment: params.comment,
        rating: params.rating,
        correctionText: params.correctionText,
      },
    });
  }
}
