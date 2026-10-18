import { describe, it, expect } from 'vitest';
import { VerificationEvidenceAdapter } from '../../../src/knowledge/update/adapters/VerificationEvidenceAdapter.js';
import type { VerificationRecord } from '../../../src/verification/models/VerificationRecord.js';

describe('VerificationEvidenceAdapter', () => {
  const adapter = new VerificationEvidenceAdapter();

  it('translates trusted VerificationRecord into VERIFICATION_CHANGED update parameters', () => {
    const record: VerificationRecord = {
      verificationId: 'v-100',
      workspaceId: 'ws-1',
      repositoryId: 'repo-1',
      taskId: 'task-1',
      verificationType: 'TEST',
      status: 'PASSED',
      source: 'CI',
      provenance: {
        source: 'CI',
        reportedBy: 'GitHubActions',
        receivedAt: '2026-09-20T20:00:00Z',
        observedAt: '2026-09-20T20:01:00Z',
        verificationLevel: 'SYSTEM_VERIFIED',
        trustLevel: 'TRUSTED',
      },
      confidence: 'HIGH',
      repositoryState: {
        status: 'BOUND',
        commitId: 'commit-abc',
      },
      scope: {
        scopeType: 'FEATURE',
        targetFiles: ['tests/auth/login.test.ts'],
        featureIds: ['feat-auth'],
      },
      receivedAt: '2026-09-20T20:00:00Z',
      completedAt: '2026-09-20T20:01:00Z',
      summary: 'Auth tests passed',
      diagnostics: [],
      evidence: { passed: true } as any,
      metadata: {},
    };

    const params = adapter.toUpdateParams(record);

    expect(params.sourceEventId).toBe('v-100');
    expect(params.source).toBe('VERIFICATION_EVIDENCE');
    expect(params.provenance).toBe('SYSTEM_VERIFIED');
    expect(params.updateType).toBe('VERIFICATION_CHANGED');
    expect(params.affectedResources).toContain('tests/auth/login.test.ts');
    expect(params.affectedFeatures).toContain('feat-auth');
    expect(params.confidence).toBe(0.85);
  });
});
