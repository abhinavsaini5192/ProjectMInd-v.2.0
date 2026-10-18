import { describe, it, expect, vi } from 'vitest';
import { KnowledgeInvalidationManager } from '../../../src/knowledge/update/core/KnowledgeInvalidationManager.js';
import { InMemoryKnowledgeUpdateRepository } from '../../../src/knowledge/update/core/InMemoryKnowledgeUpdateRepository.js';
import { KNOWLEDGE_UPDATE_EVENTS } from '../../../src/knowledge/update/events/KnowledgeUpdateEvents.js';
import type { IEventBus } from '../../../src/workspace/interfaces/IEventBus.js';

describe('KnowledgeInvalidationManager', () => {
  it('records feature and resource invalidations, stores them, and publishes events', async () => {
    const repository = new InMemoryKnowledgeUpdateRepository();
    const publishedEvents: any[] = [];
    const eventBus: IEventBus = {
      publish: vi.fn((event, payload) => {
        publishedEvents.push({ event, payload });
      }),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    } as any;

    const manager = new KnowledgeInvalidationManager(repository, eventBus);

    const invalidations = await manager.invalidate('upd-100', 'repo-1', 'ws-1', [
      { targetType: 'FEATURE', targetId: 'feat-auth', reason: 'Feature files modified' },
      { targetType: 'RESOURCE', targetId: 'src/auth/service.ts', reason: 'Resource content updated' },
    ]);

    expect(invalidations).toHaveLength(2);
    expect(invalidations[0]!.updateId).toBe('upd-100');
    expect(invalidations[0]!.targetType).toBe('FEATURE');
    expect(invalidations[0]!.targetId).toBe('feat-auth');
    expect(invalidations[1]!.targetType).toBe('RESOURCE');
    expect(invalidations[1]!.targetId).toBe('src/auth/service.ts');

    const stored = await manager.getInvalidations('upd-100');
    expect(stored).toHaveLength(2);

    expect(eventBus.publish).toHaveBeenCalledTimes(2);
    expect(publishedEvents[0].event).toBe(KNOWLEDGE_UPDATE_EVENTS.INVALIDATED);
  });
});
