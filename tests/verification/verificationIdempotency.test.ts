import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryVerificationStore } from '../../src/verification/services/InMemoryVerificationStore.js';
import { VerificationProcessor } from '../../src/verification/services/VerificationProcessor.js';
import type { IEventBus } from '../../src/workspace/interfaces/IEventBus.js';

describe('Verification Idempotency & Deduplication', () => {
  let store: InMemoryVerificationStore;
  let eventBus: IEventBus;
  let processor: VerificationProcessor;
  let publishedEvents: { event: string; payload: unknown }[];

  beforeEach(() => {
    store = new InMemoryVerificationStore();
    publishedEvents = [];
    eventBus = {
      publish: vi.fn((event: string, payload: unknown) => {
        publishedEvents.push({ event, payload });
      }),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    processor = new VerificationProcessor({
      store,
      eventBus,
    });
  });

  it('deduplicates identical reports with the same operationId', async () => {
    const report = {
      taskId: 'task-idempotent-1',
      operationId: 'op-dedup-xyz-100',
      passed: true,
      summary: 'Integration tests passed',
    };

    // First submission
    const res1 = await processor.processVerification(report);
    expect(res1.processed).toBe(true);
    expect(res1.isDuplicate).toBe(false);

    const initialEventCount = publishedEvents.length;
    expect(initialEventCount).toBeGreaterThan(0);

    // Second submission with exact same operationId
    const res2 = await processor.processVerification(report);
    expect(res2.processed).toBe(true);
    expect(res2.isDuplicate).toBe(true);
    expect(res2.record.verificationId).toBe(res1.record.verificationId);

    // No extra events emitted for duplicate operation
    expect(publishedEvents.length).toBe(initialEventCount);
  });

  it('deduplicates reports with matching verificationId', async () => {
    const report = {
      verificationId: 'verif-fixed-uuid-1',
      taskId: 'task-idempotent-2',
      passed: true,
      summary: 'Build succeeded',
    };

    const res1 = await processor.processVerification(report);
    expect(res1.isDuplicate).toBe(false);

    const res2 = await processor.processVerification(report);
    expect(res2.isDuplicate).toBe(true);
    expect(res2.record.verificationId).toBe('verif-fixed-uuid-1');
  });
});
