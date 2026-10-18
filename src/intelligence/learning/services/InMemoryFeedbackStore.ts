import type { IFeedbackStore, FeedbackQuery } from '../interfaces/IFeedbackStore.js';
import type { Feedback } from '../models/Feedback.js';

export class InMemoryFeedbackStore implements IFeedbackStore {
  private readonly items = new Map<string, Feedback>();
  private readonly deduplicationIndex = new Map<string, string>();

  public async saveFeedback(feedback: Feedback): Promise<void> {
    this.items.set(feedback.id, feedback);
    if (feedback.deduplicationKey) {
      this.deduplicationIndex.set(feedback.deduplicationKey, feedback.id);
    }
  }

  public async getFeedback(id: string): Promise<Feedback | null> {
    return this.items.get(id) ?? null;
  }

  public async findDuplicate(deduplicationKey: string): Promise<Feedback | null> {
    const existingId = this.deduplicationIndex.get(deduplicationKey);
    if (!existingId) return null;
    return this.items.get(existingId) ?? null;
  }

  public async queryFeedback(query: FeedbackQuery): Promise<Feedback[]> {
    let result = Array.from(this.items.values());

    result = result.filter((item) => {
      if (item.workspaceId !== query.workspaceId) return false;
      if (query.projectId && item.projectId !== query.projectId) return false;
      if (query.targetType && item.targetType !== query.targetType) return false;
      if (query.targetId && item.targetId !== query.targetId) return false;
      if (query.sourceType && item.sourceType !== query.sourceType) return false;
      if (query.feedbackType && item.feedbackType !== query.feedbackType) return false;
      if (query.scopeLevel && item.scope.level !== query.scopeLevel) return false;
      if (query.fromTimestamp && item.timestamp < query.fromTimestamp) return false;
      if (query.toTimestamp && item.timestamp > query.toTimestamp) return false;
      return true;
    });

    result.sort((a, b) => b.timestamp - a.timestamp);

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return result.slice(offset, offset + limit);
  }

  public async countFeedback(query: FeedbackQuery): Promise<number> {
    const list = await this.queryFeedback({ ...query, limit: 10_000, offset: 0 });
    return list.length;
  }
}
