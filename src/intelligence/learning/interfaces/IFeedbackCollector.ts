import type { Feedback, RawFeedbackInput } from '../models/Feedback.js';

export interface ContextFeedbackParams {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly contextId: string;
  readonly usefulResourceIds?: readonly string[] | undefined;
  readonly irrelevantResourceIds?: readonly string[] | undefined;
  readonly missingResourceIds?: readonly string[] | undefined;
  readonly isTooLarge?: boolean | undefined;
  readonly taskId?: string | undefined;
  readonly actorId: string;
}

export interface RetrievalFeedbackParams {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly query: string;
  readonly relevantItemIds?: readonly string[] | undefined;
  readonly irrelevantItemIds?: readonly string[] | undefined;
  readonly missedItemIds?: readonly string[] | undefined;
  readonly taskId?: string | undefined;
  readonly actorId: string;
}

export interface PlanningFeedbackParams {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly planId: string;
  readonly taskId?: string | undefined;
  readonly taskType?: string | undefined;
  readonly outcome: 'SUCCESS' | 'FAILURE' | 'REPLANNED';
  readonly reason?: string | undefined;
  readonly actorId: string;
}

export interface VerificationFeedbackParams {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly verificationId: string;
  readonly passed: boolean;
  readonly taskId?: string | undefined;
  readonly targetResources?: readonly string[] | undefined;
  readonly notes?: string | undefined;
  readonly actorId: string;
}

export interface UserFeedbackParams {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly comment: string;
  readonly rating: number; // e.g. 1 to 5 or -1 to 1
  readonly userId: string;
  readonly correctionText?: string | undefined;
}

export interface IFeedbackCollector {
  recordFeedback(input: RawFeedbackInput): Promise<Feedback>;
  recordContextFeedback(params: ContextFeedbackParams): Promise<Feedback[]>;
  recordRetrievalFeedback(params: RetrievalFeedbackParams): Promise<Feedback[]>;
  recordPlanningFeedback(params: PlanningFeedbackParams): Promise<Feedback>;
  recordVerificationFeedback(params: VerificationFeedbackParams): Promise<Feedback>;
  recordUserFeedback(params: UserFeedbackParams): Promise<Feedback>;
}
