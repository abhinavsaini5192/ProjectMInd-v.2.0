import type { Feedback } from '../models/Feedback.js';
import type { FeedbackSourceType } from '../models/FeedbackSourceType.js';
import type { FeedbackType } from '../models/FeedbackType.js';
import type { ScopeLevel } from '../models/LearningScope.js';

export interface FeedbackQuery {
  readonly workspaceId: string;
  readonly projectId?: string | undefined;
  readonly targetType?: string | undefined;
  readonly targetId?: string | undefined;
  readonly sourceType?: FeedbackSourceType | undefined;
  readonly feedbackType?: FeedbackType | undefined;
  readonly scopeLevel?: ScopeLevel | undefined;
  readonly fromTimestamp?: number | undefined;
  readonly toTimestamp?: number | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface IFeedbackStore {
  saveFeedback(feedback: Feedback): Promise<void>;
  getFeedback(id: string): Promise<Feedback | null>;
  queryFeedback(query: FeedbackQuery): Promise<Feedback[]>;
  findDuplicate(deduplicationKey: string): Promise<Feedback | null>;
  countFeedback(query: FeedbackQuery): Promise<number>;
}
