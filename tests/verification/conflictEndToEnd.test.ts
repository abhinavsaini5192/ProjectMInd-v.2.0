import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryVerificationStore } from '../../src/verification/services/InMemoryVerificationStore.js';
import { VerificationProcessor } from '../../src/verification/services/VerificationProcessor.js';
import { VerificationQueryService } from '../../src/verification/services/VerificationQueryService.js';

describe('Phase 7.7 Section 57 Conflict End-to-End Scenario: Conflicting verification evidence', () => {
  let store: InMemoryVerificationStore;
  let processor: VerificationProcessor;
  let queryService: VerificationQueryService;

  const taskId = 'task-conflict-auth';

  beforeEach(() => {
    store = new InMemoryVerificationStore();
    processor = new VerificationProcessor({ store });
    queryService = new VerificationQueryService(store);
  });

  it('detects conflict between agent and CI, marks completion NOT_READY with structured reason', async () => {
    // 1. Agent reports: tests = PASSED
    await processor.processVerification({
      taskId,
      verificationType: 'TEST',
      passed: true,
      source: 'AGENT',
      summary: 'Agent says tests passed locally',
    });

    // 2. CI reports: tests = FAILED
    const ciResult = await processor.processVerification({
      taskId,
      verificationType: 'TEST',
      passed: false,
      source: 'CI',
      summary: 'CI run #505: 2 tests failed in AuthenticationSuite',
      diagnostics: ['AssertionError: Expected 200 OK but received 401 Unauthorized'],
    });

    // 3. Expected: VerificationConflict
    expect(ciResult.conflicts.length).toBeGreaterThan(0);
    const conflicts = await queryService.getVerificationConflicts(taskId);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]!.taskId).toBe(taskId);
    expect(conflicts[0]!.conflictingStatuses).toEqual(['PASSED', 'FAILED']);

    // 4. Completion check: must NOT be considered verified
    const completionEvidence = await queryService.getCompletionEvidence(taskId, {
      requiredTypes: ['TEST'],
      disallowConflicts: true,
    });

    expect(completionEvidence.canComplete).toBe(false);
    expect(completionEvidence.status).toBe('NOT_READY');
    expect(
      completionEvidence.missingConditions.some((m) =>
        m.includes('Unresolved verification conflicts detected')
      ) ||
      completionEvidence.missingConditions.some((m) =>
        m.includes('is not PASSED')
      )
    ).toBe(true);
  });
});
