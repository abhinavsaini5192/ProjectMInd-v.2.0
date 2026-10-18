import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryVerificationStore } from '../../src/verification/services/InMemoryVerificationStore.js';
import { VerificationProcessor } from '../../src/verification/services/VerificationProcessor.js';
import { VerificationQueryService } from '../../src/verification/services/VerificationQueryService.js';
import { VerificationFreshnessEvaluator } from '../../src/verification/services/VerificationFreshnessEvaluator.js';

describe('Phase 7.7 Section 56 End-to-End Scenario: Fix login request timeout', () => {
  let store: InMemoryVerificationStore;
  let freshnessEvaluator: VerificationFreshnessEvaluator;
  let processor: VerificationProcessor;
  let queryService: VerificationQueryService;

  const taskId = 'task-login-timeout-fix';
  const targetResource = 'src/auth/AuthService.ts';

  beforeEach(() => {
    store = new InMemoryVerificationStore();
    freshnessEvaluator = new VerificationFreshnessEvaluator();
    processor = new VerificationProcessor({ store, freshnessEvaluator });
    queryService = new VerificationQueryService(store, freshnessEvaluator);
  });

  it('progresses through agent report -> CI verification -> build -> completion -> staleness invalidation', async () => {
    // 1. Agent reports: TEST: Authentication integration tests = PASSED
    const agentReportRes = await processor.processVerification({
      taskId,
      verificationType: 'TEST',
      passed: true,
      source: 'AGENT',
      reportedBy: 'claude-code-agent',
      summary: 'Authentication integration tests passed locally',
      scope: { scopeType: 'RESOURCE', targetFiles: [targetResource] },
      repositoryState: { status: 'BOUND', commitId: 'commit-auth-001' },
    });

    expect(agentReportRes.record.status).toBe('PASSED');
    expect(agentReportRes.record.provenance.verificationLevel).toBe('AGENT_REPORTED');

    // Check completion policy that requires trusted verification -> NOT_READY yet
    const preCiEvidence = await queryService.getCompletionEvidence(taskId, {
      requiredTypes: ['TEST', 'BUILD'],
      requireTrustedVerification: true,
    });
    expect(preCiEvidence.canComplete).toBe(false);
    expect(preCiEvidence.missingConditions.some((m) => m.includes('requires trusted verification'))).toBe(true);

    // 2. CI reports: TEST: Authentication integration tests = PASSED
    const ciReportRes = await processor.processVerification({
      taskId,
      verificationType: 'TEST',
      passed: true,
      source: 'CI',
      reportedBy: 'github-actions',
      summary: 'CI run #402: Authentication integration tests passed',
      scope: { scopeType: 'RESOURCE', targetFiles: [targetResource] },
      repositoryState: { status: 'BOUND', commitId: 'commit-auth-001' },
    });

    expect(ciReportRes.record.status).toBe('PASSED');
    expect(ciReportRes.record.provenance.verificationLevel).toBe('SYSTEM_VERIFIED');

    // 3. Build reports: BUILD = PASSED
    const buildReportRes = await processor.processVerification({
      taskId,
      verificationType: 'BUILD',
      passed: true,
      source: 'BUILD_SYSTEM',
      reportedBy: 'github-actions-build',
      summary: 'Production build succeeded',
      scope: { scopeType: 'REPOSITORY' },
      repositoryState: { status: 'BOUND', commitId: 'commit-auth-001' },
    });

    expect(buildReportRes.record.status).toBe('PASSED');
    expect(buildReportRes.record.provenance.verificationLevel).toBe('SYSTEM_VERIFIED');

    // 4. ProjectMind evaluates completion with required tests & build
    const completionEvidence = await queryService.getCompletionEvidence(taskId, {
      requiredTypes: ['TEST', 'BUILD'],
      requireTrustedVerification: true,
    });

    expect(completionEvidence.canComplete).toBe(true);
    expect(completionEvidence.status).toBe('READY_TO_COMPLETE');
    expect(completionEvidence.missingConditions).toHaveLength(0);

    // 5. Simulate: AuthService.ts changes again in the repository
    const subsequentChanges = {
      currentRepositoryState: { status: 'BOUND' as const, commitId: 'commit-auth-002' },
      modifiedFiles: [targetResource],
    };

    // 6. Expected: Previous verification becomes STALE
    const postChangeEvidence = await queryService.getCompletionEvidence(
      taskId,
      {
        requiredTypes: ['TEST', 'BUILD'],
        requireTrustedVerification: true,
        disallowStale: true,
      },
      subsequentChanges
    );

    expect(postChangeEvidence.canComplete).toBe(false);
    expect(postChangeEvidence.status).toBe('NOT_READY');
    expect(postChangeEvidence.hasStaleEvidence).toBe(true);
    expect(postChangeEvidence.missingConditions.some((m) => m.includes('is STALE'))).toBe(true);
  });
});
