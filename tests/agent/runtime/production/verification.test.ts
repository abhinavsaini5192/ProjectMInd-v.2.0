import { describe, it, expect } from 'vitest';
import { createTestProductionRuntime } from './ProductionRuntimeTestHelper.js';

describe('ProductionAgentRuntime - Verification Coordination', () => {
  it('allows completion when task verification has PASSED', async () => {
    const ctx = createTestProductionRuntime({ verificationState: 'PASSED' });
    const coordinator = (ctx.runtime as any).coordinator.verification;

    const result = await coordinator.verifyTask('task_1', {
      workspaceId: 'ws_1',
      repositoryId: 'repo_1',
      agentSessionId: 'sess_1',
    });

    expect(result.canComplete).toBe(true);
    expect(result.passed).toBe(true);
    expect(result.missingConditions.length).toBe(0);
  });

  it('detects failed verification and rejects completion readiness', async () => {
    const ctx = createTestProductionRuntime({ verificationState: 'FAILED' });
    const coordinator = (ctx.runtime as any).coordinator.verification;

    const result = await coordinator.verifyTask('task_1', {
      workspaceId: 'ws_1',
      repositoryId: 'repo_1',
      agentSessionId: 'sess_1',
    });

    expect(result.canComplete).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('Verification reports show test or build failure');
  });

  it('records verification report and updates verification state', async () => {
    const ctx = createTestProductionRuntime({ verificationState: 'NOT_STARTED' });
    const coordinator = (ctx.runtime as any).coordinator.verification;

    const repResult = await coordinator.recordVerificationReport(
      {
        taskId: 'task_1',
        passed: true,
        summary: 'All unit tests pass',
      },
      {
        workspaceId: 'ws_1',
        repositoryId: 'repo_1',
        agentSessionId: 'sess_1',
      }
    );

    expect(repResult.recorded).toBe(true);
    expect(repResult.status).toBe('PASSED');

    const check = await coordinator.verifyTask('task_1', {
      workspaceId: 'ws_1',
      repositoryId: 'repo_1',
      agentSessionId: 'sess_1',
    });
    expect(check.canComplete).toBe(true);
  });
});
