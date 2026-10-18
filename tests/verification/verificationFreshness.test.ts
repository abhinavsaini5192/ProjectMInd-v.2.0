import { describe, it, expect } from 'vitest';
import { VerificationFreshnessEvaluator } from '../../src/verification/services/VerificationFreshnessEvaluator.js';
import type { VerificationRecord } from '../../src/verification/models/VerificationRecord.js';

describe('Verification Smart Freshness Evaluator', () => {
  const evaluator = new VerificationFreshnessEvaluator();

  function createSampleRecord(overrides: Partial<VerificationRecord> = {}): VerificationRecord {
    return {
      verificationId: 'verif-test-1',
      taskId: 'task-login',
      workspaceId: 'workspace-a',
      repositoryId: 'repo-1',
      verificationType: 'TEST',
      status: 'PASSED',
      source: 'CI',
      provenance: {
        source: 'CI',
        reportedBy: 'ci-bot',
        receivedAt: '2026-09-20T10:00:00Z',
        verificationLevel: 'SYSTEM_VERIFIED',
        trustLevel: 'AUTHORITATIVE',
      },
      confidence: 'HIGH',
      repositoryState: {
        status: 'BOUND',
        commitId: 'commit-aaa-111',
      },
      scope: {
        scopeType: 'RESOURCE',
        targetFiles: ['src/auth/AuthService.ts'],
        featureIds: ['feat-auth'],
      },
      receivedAt: '2026-09-20T10:00:00Z',
      summary: 'Auth tests passed',
      diagnostics: [],
      evidence: { summary: 'Passed' },
      metadata: {},
      ...overrides,
    };
  }

  it('evaluates to CURRENT when repository state matches exactly', () => {
    const record = createSampleRecord();
    const freshness = evaluator.evaluateFreshness(record, {
      currentRepositoryState: {
        status: 'BOUND',
        commitId: 'commit-aaa-111',
      },
    });

    expect(freshness.status).toBe('CURRENT');
  });

  it('evaluates to STALE when verified resource is modified', () => {
    const record = createSampleRecord();
    const freshness = evaluator.evaluateFreshness(record, {
      currentRepositoryState: {
        status: 'BOUND',
        commitId: 'commit-bbb-222',
      },
      modifiedFiles: ['src/auth/AuthService.ts'],
    });

    expect(freshness.status).toBe('STALE');
    expect(freshness.staleReason).toContain('Verified resources were modified');
    expect(freshness.invalidatedBy).toContain('src/auth/authservice.ts');
  });

  it('evaluates to CURRENT when only unrelated files (e.g. README.md) are modified', () => {
    const record = createSampleRecord();
    const freshness = evaluator.evaluateFreshness(record, {
      currentRepositoryState: {
        status: 'BOUND',
        commitId: 'commit-bbb-222',
      },
      modifiedFiles: ['README.md', 'docs/notes.txt'],
    });

    expect(freshness.status).toBe('CURRENT');
  });

  it('evaluates to STALE when verified feature is affected by changes', () => {
    const record = createSampleRecord();
    const freshness = evaluator.evaluateFreshness(record, {
      currentRepositoryState: {
        status: 'BOUND',
        commitId: 'commit-bbb-222',
      },
      changedFeatures: ['feat-auth'],
    });

    expect(freshness.status).toBe('STALE');
    expect(freshness.staleReason).toContain('Verified features were affected by changes');
    expect(freshness.invalidatedBy).toContain('feat-auth');
  });

  it('differentiates repository-scoped verification between doc changes and code changes', () => {
    const repoRecord = createSampleRecord({
      scope: {
        scopeType: 'REPOSITORY',
        targetFiles: [],
      },
    });

    // Only docs modified -> remains CURRENT
    const docFreshness = evaluator.evaluateFreshness(repoRecord, {
      modifiedFiles: ['README.md', 'docs/architecture.md'],
    });
    expect(docFreshness.status).toBe('CURRENT');

    // Code modified -> becomes STALE
    const codeFreshness = evaluator.evaluateFreshness(repoRecord, {
      modifiedFiles: ['src/core/Engine.ts'],
    });
    expect(codeFreshness.status).toBe('STALE');
    expect(codeFreshness.staleReason).toContain('Repository-scoped verification is stale');
  });
});
