import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryVerificationStore } from '../../src/verification/services/InMemoryVerificationStore.js';
import { VerificationQueryService } from '../../src/verification/services/VerificationQueryService.js';
import { VerificationFreshnessEvaluator } from '../../src/verification/services/VerificationFreshnessEvaluator.js';
import { TaskCompletionValidator } from '../../src/agent/runtime/services/TaskCompletionValidator.js';
import type { ITaskStore } from '../../src/agent/runtime/interfaces/ITaskStore.js';
import type { AgentTask } from '../../src/agent/context/models/AgentTask.js';
import type { VerificationRecord } from '../../src/verification/models/VerificationRecord.js';

describe('Task Completion Verification Integration', () => {
  let vStore: InMemoryVerificationStore;
  let queryService: VerificationQueryService;
  let mockTaskStore: ITaskStore;
  let validator: TaskCompletionValidator;

  const sampleTask: AgentTask = {
    taskId: 'task-auth-complete',
    contextSessionId: 'ctx-1',
    agentSessionId: 'sess-1',
    workspaceId: 'ws-1',
    repositoryId: 'repo-1',
    title: 'Fix auth token expiry',
    description: 'Ensure expired tokens are refreshed properly',
    intent: 'Ensure expired tokens are refreshed properly',
    status: 'IN_PROGRESS',
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {},
  };

  beforeEach(() => {
    vStore = new InMemoryVerificationStore();
    queryService = new VerificationQueryService(vStore, new VerificationFreshnessEvaluator());

    mockTaskStore = {
      getTask: async () => sampleTask,
      saveTask: async () => {},
      updateTask: async () => {},
      listTasks: async () => [sampleTask],
      getExecutionState: async () => ({
        taskId: sampleTask.taskId,
        executionState: 'COMPLETED',
        modifiedFiles: ['src/auth/AuthService.ts'],
        completedAt: new Date().toISOString(),
      }),
      getVerificationState: async () => ({
        taskId: sampleTask.taskId,
        verificationState: 'PASSED',
        tests: { status: 'PASSED', passedCount: 5, failedCount: 0 },
        build: { status: 'PASSED' },
      }),
      saveExecutionState: async () => {},
      saveVerificationState: async () => {},
    } as unknown as ITaskStore;

    validator = new TaskCompletionValidator(mockTaskStore, queryService);
  });

  function makeRecord(
    id: string,
    type: 'TEST' | 'BUILD',
    status: 'PASSED' | 'FAILED',
    source: 'AGENT' | 'CI',
    level: 'AGENT_REPORTED' | 'SYSTEM_VERIFIED',
    targetFiles: string[] = ['src/auth/AuthService.ts']
  ): VerificationRecord {
    return {
      verificationId: id,
      taskId: sampleTask.taskId,
      workspaceId: 'workspace-a',
      repositoryId: 'repo-1',
      verificationType: type,
      status,
      source,
      provenance: {
        source,
        reportedBy: source.toLowerCase(),
        receivedAt: new Date().toISOString(),
        verificationLevel: level,
        trustLevel: level === 'SYSTEM_VERIFIED' ? 'AUTHORITATIVE' : 'SEMI_TRUSTED',
      },
      confidence: 'HIGH',
      repositoryState: { status: 'BOUND', commitId: 'c1' },
      scope: { scopeType: 'TASK', targetFiles },
      receivedAt: new Date().toISOString(),
      summary: `${type} ${status}`,
      diagnostics: [],
      evidence: { summary: `${type} ${status}` },
      metadata: {},
    };
  }

  it('returns NOT_READY when required verification is missing from store', async () => {
    const result = await validator.validate(sampleTask, {
      verificationPolicy: {
        requiredTypes: ['TEST', 'BUILD'],
      },
    });

    expect(result.canComplete).toBe(false);
    expect(result.status).toBe('NOT_READY');
    expect(result.missingConditions).toContain("Required verification 'TEST' is missing");
    expect(result.missingConditions).toContain("Required verification 'BUILD' is missing");
    expect(result.completionEvidence).toBeDefined();
    expect(result.completionEvidence?.canComplete).toBe(false);
  });

  it('returns NOT_READY when trusted verification is required but only agent-reported evidence exists', async () => {
    // Only agent-reported tests and build exist
    await vStore.saveVerification(makeRecord('v1', 'TEST', 'PASSED', 'AGENT', 'AGENT_REPORTED'));
    await vStore.saveVerification(makeRecord('v2', 'BUILD', 'PASSED', 'AGENT', 'AGENT_REPORTED'));

    const result = await validator.validate(sampleTask, {
      requireTrustedVerification: true,
      verificationPolicy: {
        requiredTypes: ['TEST', 'BUILD'],
        requireTrustedVerification: true,
      },
    });

    expect(result.canComplete).toBe(false);
    expect(result.status).toBe('NOT_READY');
    expect(result.missingConditions.some((m) => m.includes('requires trusted verification'))).toBe(true);
    expect(result.reasons.some((r) => r.includes('exists only as agent-reported evidence'))).toBe(true);
  });

  it('returns READY_TO_COMPLETE when trusted verification is present, fresh, and passed', async () => {
    await vStore.saveVerification(makeRecord('v1', 'TEST', 'PASSED', 'CI', 'SYSTEM_VERIFIED'));
    await vStore.saveVerification(makeRecord('v2', 'BUILD', 'PASSED', 'CI', 'SYSTEM_VERIFIED'));

    const result = await validator.validate(sampleTask, {
      requireTrustedVerification: true,
      verificationPolicy: {
        requiredTypes: ['TEST', 'BUILD'],
        requireTrustedVerification: true,
      },
    });

    expect(result.canComplete).toBe(true);
    expect(result.status).toBe('READY_TO_COMPLETE');
    expect(result.missingConditions).toHaveLength(0);
    expect(result.completionEvidence?.canComplete).toBe(true);
    expect(result.completionEvidence?.confidence).toBe('HIGH');
  });

  it('returns NOT_READY when unresolved verification conflicts exist for the task', async () => {
    await vStore.saveVerification(makeRecord('v1', 'TEST', 'PASSED', 'AGENT', 'AGENT_REPORTED'));
    await vStore.saveVerification(makeRecord('v2', 'BUILD', 'PASSED', 'CI', 'SYSTEM_VERIFIED'));

    await vStore.saveConflict({
      conflictId: 'conf-123',
      verificationIds: ['v1', 'v_other'],
      taskId: sampleTask.taskId,
      verificationType: 'TEST',
      conflictingStatuses: ['PASSED', 'FAILED'],
      sources: ['AGENT', 'CI'],
      severity: 'HIGH',
      resolutionStatus: 'UNRESOLVED',
      createdAt: new Date().toISOString(),
    });

    const result = await validator.validate(sampleTask, {
      disallowConflictingVerification: true,
      verificationPolicy: {
        requiredTypes: ['TEST', 'BUILD'],
        disallowConflicts: true,
      },
    });

    expect(result.canComplete).toBe(false);
    expect(result.status).toBe('NOT_READY');
    expect(result.missingConditions.some((m) => m.includes('Unresolved verification conflicts detected'))).toBe(true);
    expect(result.completionEvidence?.hasConflictingEvidence).toBe(true);
  });
});
