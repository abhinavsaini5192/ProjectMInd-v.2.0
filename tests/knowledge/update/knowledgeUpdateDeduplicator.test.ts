import { describe, it, expect } from 'vitest';
import { KnowledgeUpdateDeduplicator } from '../../../src/knowledge/update/core/KnowledgeUpdateDeduplicator.js';
import { InMemoryKnowledgeUpdateRepository } from '../../../src/knowledge/update/core/InMemoryKnowledgeUpdateRepository.js';
import { KnowledgeUpdateNormalizer } from '../../../src/knowledge/update/core/KnowledgeUpdateNormalizer.js';

describe('KnowledgeUpdateDeduplicator', () => {
  const normalizer = new KnowledgeUpdateNormalizer();

  it('detects existing update with matching idempotency key', async () => {
    const repo = new InMemoryKnowledgeUpdateRepository();
    const deduplicator = new KnowledgeUpdateDeduplicator(repo);

    const update1 = normalizer.normalize({
      repositoryId: 'repo-1',
      sourceEventId: 'evt-1',
      source: 'EXECUTION_OBSERVATION',
      updateType: 'RESOURCE_CHANGED',
    });

    await repo.saveUpdate(update1);

    const duplicateCheck = await deduplicator.checkDuplicate(update1);
    expect(duplicateCheck).not.toBeNull();
    expect(duplicateCheck?.updateId).toBe(update1.updateId);
  });

  it('deduplicates batch of updates with identical idempotency keys', () => {
    const deduplicator = new KnowledgeUpdateDeduplicator();

    const u1 = normalizer.normalize({
      repositoryId: 'repo-1',
      sourceEventId: 'evt-dup',
      source: 'EXECUTION_OBSERVATION',
      updateType: 'RESOURCE_CHANGED',
    });

    const u2 = normalizer.normalize({
      repositoryId: 'repo-1',
      sourceEventId: 'evt-dup',
      source: 'EXECUTION_OBSERVATION',
      updateType: 'RESOURCE_CHANGED',
    });

    const deduplicated = deduplicator.deduplicateBatch([u1, u2]);
    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0]?.updateId).toBe(u1.updateId);
  });
});
