import type { KnowledgeUpdate } from '../models/KnowledgeUpdate.js';
import type { IKnowledgeUpdateRepository } from '../interfaces/IKnowledgeUpdateRepository.js';

export class KnowledgeUpdateDeduplicator {
  constructor(private readonly repository?: IKnowledgeUpdateRepository | undefined) {}

  public async checkDuplicate(update: KnowledgeUpdate): Promise<KnowledgeUpdate | null> {
    if (!this.repository) return null;
    return this.repository.getUpdateByIdempotencyKey(update.idempotencyKey);
  }

  public deduplicateBatch(updates: readonly KnowledgeUpdate[]): KnowledgeUpdate[] {
    const seenKeys = new Set<string>();
    const deduplicated: KnowledgeUpdate[] = [];

    for (const update of updates) {
      if (!seenKeys.has(update.idempotencyKey)) {
        seenKeys.add(update.idempotencyKey);
        deduplicated.push(update);
      }
    }

    return deduplicated;
  }
}
