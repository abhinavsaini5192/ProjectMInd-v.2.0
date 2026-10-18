import { describe, it, expect, vi } from 'vitest';
import { InMemoryVerificationStore } from '../../src/verification/services/InMemoryVerificationStore.js';
import { VerificationProcessor } from '../../src/verification/services/VerificationProcessor.js';
import { VerificationEvents } from '../../src/verification/events/VerificationEvents.js';
import type { IEventBus } from '../../src/workspace/interfaces/IEventBus.js';

describe('Phase 7.7 Section 58 Feature Health Scenario: Verification evidence emission', () => {
  it('emits verification failure events with feature scoping for Feature Health consumption', async () => {
    const emittedEvents: Array<{ event: string; payload: any }> = [];

    const mockEventBus: IEventBus = {
      publish: vi.fn((event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      }),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };

    const store = new InMemoryVerificationStore();
    const processor = new VerificationProcessor({ store, eventBus: mockEventBus });

    // Authentication tests repeatedly fail
    for (let i = 1; i <= 3; i++) {
      await processor.processVerification({
        taskId: `task-auth-attempt-${i}`,
        verificationType: 'TEST',
        passed: false,
        source: 'CI',
        summary: `Authentication tests failed on run ${i}`,
        scope: {
          scopeType: 'FEATURE',
          featureIds: ['feat-authentication'],
          targetFiles: ['src/auth/AuthService.ts'],
        },
        diagnostics: [`Failure on attempt ${i}: TokenExpiredException`],
      });
    }

    // Verify verification.failed events were emitted with feature references
    const failureEvents = emittedEvents.filter(
      (e) => e.event === VerificationEvents.VERIFICATION_FAILED
    );
    expect(failureEvents.length).toBe(3);

    for (const evt of failureEvents) {
      expect(evt.payload.record.scope.featureIds).toContain('feat-authentication');
      expect(evt.payload.diagnostics.length).toBeGreaterThan(0);
    }
  });
});
