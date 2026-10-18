import { describe, it, expect } from 'vitest';
import type { VerificationRecord } from '../../src/verification/models/VerificationRecord.js';
import { isVerificationSuccessful, isVerificationTerminal } from '../../src/verification/models/VerificationStatus.js';
import { isTrustedVerification } from '../../src/verification/models/VerificationProvenance.js';
import { isVerificationFresh } from '../../src/verification/models/VerificationFreshness.js';
import { UNKNOWN_REPOSITORY_STATE } from '../../src/verification/models/VerificationRepositoryState.js';
import { VERIFICATION_TYPES } from '../../src/verification/models/VerificationType.js';

describe('Verification Models & Enums', () => {
  it('creates valid VerificationRecord across all canonical verification types', () => {
    for (const vType of VERIFICATION_TYPES) {
      const record: VerificationRecord = {
        verificationId: `verif_${vType.toLowerCase()}_123`,
        taskId: 'task-test-1',
        workspaceId: 'workspace-a',
        repositoryId: 'repo-1',
        verificationType: vType,
        status: 'PASSED',
        source: 'CI',
        provenance: {
          source: 'CI',
          reportedBy: 'github-actions-ci',
          receivedAt: new Date().toISOString(),
          verificationLevel: 'SYSTEM_VERIFIED',
          trustLevel: 'AUTHORITATIVE',
        },
        confidence: 'HIGH',
        repositoryState: {
          status: 'BOUND',
          commitId: 'abc123commit',
          branch: 'main',
        },
        scope: {
          scopeType: 'TASK',
          targetIds: ['task-test-1'],
        },
        receivedAt: new Date().toISOString(),
        summary: `Verification of type ${vType} succeeded`,
        diagnostics: [],
        evidence: {
          summary: 'All checks passed',
        },
        metadata: {},
      };

      expect(record.verificationType).toBe(vType);
      expect(record.status).toBe('PASSED');
      expect(isVerificationSuccessful(record.status)).toBe(true);
      expect(isVerificationTerminal(record.status)).toBe(true);
      expect(isTrustedVerification(record.provenance)).toBe(true);
    }
  });

  it('correctly evaluates status helper functions', () => {
    expect(isVerificationSuccessful('PASSED')).toBe(true);
    expect(isVerificationSuccessful('FAILED')).toBe(false);
    expect(isVerificationSuccessful('SKIPPED')).toBe(false);
    expect(isVerificationSuccessful('RUNNING')).toBe(false);

    expect(isVerificationTerminal('PASSED')).toBe(true);
    expect(isVerificationTerminal('FAILED')).toBe(true);
    expect(isVerificationTerminal('PARTIAL')).toBe(true);
    expect(isVerificationTerminal('SKIPPED')).toBe(true);
    expect(isVerificationTerminal('CANCELLED')).toBe(true);
    expect(isVerificationTerminal('RUNNING')).toBe(false);
    expect(isVerificationTerminal('UNKNOWN')).toBe(false);
  });

  it('correctly identifies trusted vs agent-reported provenance', () => {
    const trustedProvenance = {
      source: 'CI' as const,
      reportedBy: 'ci-runner',
      receivedAt: new Date().toISOString(),
      verificationLevel: 'SYSTEM_VERIFIED' as const,
      trustLevel: 'AUTHORITATIVE' as const,
    };
    expect(isTrustedVerification(trustedProvenance)).toBe(true);

    const agentProvenance = {
      source: 'AGENT' as const,
      reportedBy: 'cursor-agent',
      receivedAt: new Date().toISOString(),
      verificationLevel: 'AGENT_REPORTED' as const,
      trustLevel: 'SEMI_TRUSTED' as const,
    };
    expect(isTrustedVerification(agentProvenance)).toBe(false);

    const manualProvenance = {
      source: 'MANUAL' as const,
      reportedBy: 'lead-engineer',
      receivedAt: new Date().toISOString(),
      verificationLevel: 'MANUALLY_CONFIRMED' as const,
      trustLevel: 'TRUSTED' as const,
    };
    expect(isTrustedVerification(manualProvenance)).toBe(true);
  });

  it('evaluates freshness status correctly', () => {
    expect(isVerificationFresh({ status: 'CURRENT', evaluatedAt: new Date().toISOString() })).toBe(true);
    expect(isVerificationFresh({ status: 'STALE', evaluatedAt: new Date().toISOString() })).toBe(false);
    expect(isVerificationFresh({ status: 'PARTIALLY_STALE', evaluatedAt: new Date().toISOString() })).toBe(false);
    expect(isVerificationFresh({ status: 'UNKNOWN', evaluatedAt: new Date().toISOString() })).toBe(false);
  });

  it('defaults UNKNOWN_REPOSITORY_STATE status to UNKNOWN', () => {
    expect(UNKNOWN_REPOSITORY_STATE.status).toBe('UNKNOWN');
    expect(UNKNOWN_REPOSITORY_STATE.commitId).toBeUndefined();
  });
});
