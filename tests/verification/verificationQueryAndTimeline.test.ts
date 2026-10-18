import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryVerificationStore } from '../../src/verification/services/InMemoryVerificationStore.js';
import { VerificationProcessor } from '../../src/verification/services/VerificationProcessor.js';
import { VerificationQueryService } from '../../src/verification/services/VerificationQueryService.js';

describe('Verification Query Service & Timeline', () => {
  let store: InMemoryVerificationStore;
  let processor: VerificationProcessor;
  let queryService: VerificationQueryService;

  beforeEach(async () => {
    store = new InMemoryVerificationStore();
    processor = new VerificationProcessor({ store });
    queryService = new VerificationQueryService(store);

    // Seed verifications for task-query-1
    await processor.processVerification({
      taskId: 'task-query-1',
      verificationType: 'TEST',
      passed: false,
      summary: 'Unit tests failed initial run',
      scope: { scopeType: 'RESOURCE', targetFiles: ['src/auth/AuthService.ts'] },
      startedAt: '2026-09-20T09:10:00Z',
      completedAt: '2026-09-20T09:12:00Z',
    });

    await processor.processVerification({
      taskId: 'task-query-1',
      verificationType: 'TEST',
      passed: true,
      summary: 'Unit tests passed after fix',
      scope: { scopeType: 'RESOURCE', targetFiles: ['src/auth/AuthService.ts'] },
      startedAt: '2026-09-20T09:18:00Z',
      completedAt: '2026-09-20T09:20:00Z',
    });

    await processor.processVerification({
      taskId: 'task-query-1',
      verificationType: 'BUILD',
      passed: true,
      summary: 'Production build passed',
      scope: { scopeType: 'REPOSITORY' },
      startedAt: '2026-09-20T09:20:30Z',
      completedAt: '2026-09-20T09:21:00Z',
    });
  });

  it('queries verifications filtered by taskId', async () => {
    const records = await queryService.getTaskVerifications('task-query-1');
    expect(records.length).toBe(3);
  });

  it('queries verifications filtered by resource path', async () => {
    const records = await queryService.getResourceVerifications('AuthService.ts');
    expect(records.length).toBe(2);
  });

  it('generates structured summary for task', async () => {
    const summary = await queryService.getVerificationSummary('task-query-1');
    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.latestStatus).toBe('PASSED');
    expect(summary.byType['TEST']?.total).toBe(2);
    expect(summary.byType['BUILD']?.total).toBe(1);
  });

  it('builds chronological verification timeline', async () => {
    const timeline = await queryService.getVerificationTimeline('task-query-1');
    expect(timeline.totalEntries).toBe(3);

    // Entries should be sorted chronologically ascending
    expect(timeline.entries[0]!.summary).toContain('Unit tests failed initial run');
    expect(timeline.entries[1]!.summary).toContain('Unit tests passed after fix');
    expect(timeline.entries[2]!.summary).toContain('Production build passed');
  });

  it('retrieves latest verification for specific type', async () => {
    const latestTest = await queryService.getLatestVerification('task-query-1', 'TEST');
    expect(latestTest.record).toBeDefined();
    expect(latestTest.record?.status).toBe('PASSED');
    expect(latestTest.record?.summary).toContain('Unit tests passed after fix');
  });
});
