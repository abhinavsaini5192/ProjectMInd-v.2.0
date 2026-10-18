import { describe, it, expect, vi } from 'vitest';
import { KnowledgeReconciliationService } from '../../src/reliability/consistency/KnowledgeReconciliationService.js';

describe('Reliability - KnowledgeReconciliationService', () => {
  it('detects missing derived state when resources updated without feature mappings', async () => {
    const mockVersionManager = {
      getLatestVersion: vi.fn().mockResolvedValue({
        versionNumber: 4,
        repositoryId: 'repo-alpha',
        affectedResources: ['src/auth/service.ts'],
        affectedFeatures: [], // Missing derived feature mapping!
      }),
    } as any;

    const recon = new KnowledgeReconciliationService(mockVersionManager);
    recon.registerRepository('repo-alpha');

    const plan = await recon.inspectConsistency('repo-alpha');

    expect(plan.inconsistencies).toHaveLength(1);
    expect(plan.inconsistencies[0]?.type).toBe('MISSING_DERIVED_STATE');
    expect(plan.inconsistencies[0]?.severity).toBe('MEDIUM');
    expect(plan.actions).toHaveLength(1);
    expect(plan.requiresManualReview).toBe(false);
  });

  it('safely dispatches background job to regenerate derived feature state', async () => {
    const mockVersionManager = {
      getLatestVersion: vi.fn().mockResolvedValue({
        versionNumber: 7,
        repositoryId: 'repo-beta',
        affectedResources: ['src/payment/checkout.ts'],
        affectedFeatures: [],
      }),
    } as any;

    const mockJobDispatcher = {
      dispatch: vi.fn().mockResolvedValue({
        jobId: 'job-recon-1',
        status: 'QUEUED',
      }),
    } as any;

    const recon = new KnowledgeReconciliationService(mockVersionManager, mockJobDispatcher);
    recon.registerRepository('repo-beta');

    const report = await recon.reconcileRepository('repo-beta');

    expect(report.inconsistenciesDetected).toBe(1);
    expect(report.inconsistenciesResolved).toBe(1);
    expect(report.manualReviewItems).toHaveLength(0);
    expect(mockJobDispatcher.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'FEATURE_MAPPING',
        repositoryId: 'repo-beta',
        idempotencyKey: 'recon-repo-beta-7',
      })
    );
  });

  it('does not automatically rewrite high severity inconsistencies and routes to manual review', async () => {
    const recon = new KnowledgeReconciliationService();
    // Subclass or mock inspectConsistency to simulate high severity corrupt derived state
    recon.inspectConsistency = vi.fn().mockResolvedValue({
      inconsistencies: [
        {
          resourceId: 'repo-gamma',
          type: 'STALE_DERIVED_STATE',
          sourceVersion: 10,
          description: 'Corrupted dependency cycle detected in graph',
          severity: 'HIGH',
        },
      ],
      actions: ['Requires operator verification'],
      requiresManualReview: true,
    });

    const report = await recon.reconcileRepository('repo-gamma');

    expect(report.inconsistenciesDetected).toBe(1);
    expect(report.inconsistenciesResolved).toBe(0);
    expect(report.manualReviewItems).toHaveLength(1);
    expect(report.manualReviewItems[0]?.severity).toBe('HIGH');
  });

  it('reconciles multiple registered repositories in batch', async () => {
    const mockVersionManager = {
      getLatestVersion: vi.fn().mockImplementation(async (repoId: string) => {
        if (repoId === 'repo-1') {
          return { versionNumber: 2, affectedResources: ['a.ts'], affectedFeatures: [] };
        }
        return { versionNumber: 5, affectedResources: ['b.ts'], affectedFeatures: ['feat-b'] };
      }),
    } as any;

    const mockDispatcher = {
      dispatch: vi.fn().mockResolvedValue({ jobId: 'j-1' }),
    } as any;

    const recon = new KnowledgeReconciliationService(mockVersionManager, mockDispatcher);
    recon.registerRepository('repo-1');
    recon.registerRepository('repo-2');

    const report = await recon.reconcileAll();

    expect(report.inconsistenciesDetected).toBe(1);
    expect(report.inconsistenciesResolved).toBe(1);
  });
});
