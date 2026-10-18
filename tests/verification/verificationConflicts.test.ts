import { describe, it, expect } from 'vitest';
import { VerificationConflictResolver } from '../../src/verification/services/VerificationConflictResolver.js';
import type { VerificationRecord } from '../../src/verification/models/VerificationRecord.js';

describe('Verification Conflict Resolver', () => {
  const resolver = new VerificationConflictResolver();

  function makeRecord(
    id: string,
    status: 'PASSED' | 'FAILED',
    source: 'AGENT' | 'CI',
    level: 'AGENT_REPORTED' | 'SYSTEM_VERIFIED',
    timestamp: string
  ): VerificationRecord {
    return {
      verificationId: id,
      taskId: 'task-auth-bug',
      workspaceId: 'workspace-a',
      repositoryId: 'repo-1',
      verificationType: 'TEST',
      status,
      source,
      provenance: {
        source,
        reportedBy: source.toLowerCase(),
        receivedAt: timestamp,
        verificationLevel: level,
        trustLevel: level === 'SYSTEM_VERIFIED' ? 'AUTHORITATIVE' : 'SEMI_TRUSTED',
      },
      confidence: 'HIGH',
      repositoryState: { status: 'BOUND', commitId: 'c1' },
      scope: { scopeType: 'TASK' },
      receivedAt: timestamp,
      summary: `Tests ${status}`,
      diagnostics: [],
      evidence: { summary: status },
      metadata: {},
    };
  }

  it('detects conflict when Agent reports PASSED but CI reports FAILED', () => {
    const agentRecord = makeRecord('v1', 'PASSED', 'AGENT', 'AGENT_REPORTED', '2026-09-20T10:00:00Z');
    const ciRecord = makeRecord('v2', 'FAILED', 'CI', 'SYSTEM_VERIFIED', '2026-09-20T10:05:00Z');

    const result = resolver.detectConflicts(ciRecord, [agentRecord]);

    expect(result.detectedConflicts.length).toBe(1);
    const conflict = result.detectedConflicts[0]!;
    expect(conflict.taskId).toBe('task-auth-bug');
    expect(conflict.verificationType).toBe('TEST');
    expect(conflict.conflictingStatuses).toContain('PASSED');
    expect(conflict.conflictingStatuses).toContain('FAILED');
    expect(conflict.sources).toContain('AGENT');
    expect(conflict.sources).toContain('CI');
    // Because CI is SYSTEM_VERIFIED and newer, resolutionStatus is RESOLVED_BY_TRUSTED_SOURCE
    expect(conflict.resolutionStatus).toBe('RESOLVED_BY_TRUSTED_SOURCE');
    expect(conflict.resolvedBy).toBe('CI');
  });

  it('marks conflict as UNRESOLVED when conflicting reports come from the same trust tier', () => {
    const agent1 = makeRecord('v1', 'PASSED', 'AGENT', 'AGENT_REPORTED', '2026-09-20T10:00:00Z');
    const agent2 = makeRecord('v2', 'FAILED', 'AGENT', 'AGENT_REPORTED', '2026-09-20T10:02:00Z');

    const result = resolver.detectConflicts(agent2, [agent1]);
    expect(result.detectedConflicts.length).toBe(1);
    expect(result.hasBlockingConflicts).toBe(true);
    expect(result.detectedConflicts[0]!.resolutionStatus).toBe('UNRESOLVED');
  });

  it('explicitly resolves conflict with audit trail using resolveConflict', () => {
    const agent1 = makeRecord('v1', 'PASSED', 'AGENT', 'AGENT_REPORTED', '2026-09-20T10:00:00Z');
    const ciRecord = makeRecord('v2', 'PASSED', 'CI', 'SYSTEM_VERIFIED', '2026-09-20T10:05:00Z');

    const unresolvedConflict = {
      conflictId: 'conf-1',
      verificationIds: ['v1', 'v2'],
      taskId: 'task-auth-bug',
      verificationType: 'TEST' as const,
      conflictingStatuses: ['FAILED' as const, 'PASSED' as const],
      sources: ['AGENT' as const, 'CI' as const],
      severity: 'HIGH' as const,
      resolutionStatus: 'UNRESOLVED' as const,
      createdAt: '2026-09-20T10:05:00Z',
    };

    const resolved = resolver.resolveConflict(unresolvedConflict, [agent1, ciRecord]);
    expect(resolved.resolutionStatus).toBe('RESOLVED_BY_TRUSTED_SOURCE');
    expect(resolved.resolvedBy).toBe('CI');
    expect(resolved.resolutionReason).toContain('authoritative/trusted source');
  });
});
