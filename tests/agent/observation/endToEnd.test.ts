import { describe, it, expect } from 'vitest';
import { createObservationTestHarness } from './ObservationTestHelper.js';

describe('Phase 7.6 End-to-End Execution Observation Workflow (Section 57)', () => {
  it('executes a complete 9-step real-world coding agent lifecycle and validates observation state', async () => {
    const { processor, queryService, taskRuntime, contextSessionManager } = createObservationTestHarness();

    const taskId = 'task-fix-login-timeout';
    const sessionId = 'session-cursor-agent';
    const workspaceId = 'ws-prod';
    const repositoryId = 'repo-backend';

    // Step 1: TASK_STARTED
    const obs1 = await processor.process({
      taskId,
      sessionId,
      workspaceId,
      repositoryId,
      source: 'AGENT',
      type: 'TASK_STARTED',
      summary: 'Cursor agent started task: Fix login timeout',
      sequenceNumber: 1,
    });
    expect(obs1.observation.observationId).toBeDefined();

    // Step 2: CONTEXT_ACQUIRED
    const obs2 = await processor.process({
      taskId,
      sessionId,
      workspaceId,
      repositoryId,
      source: 'AGENT',
      type: 'CONTEXT_ACQUIRED',
      summary: 'Acquired context for auth and timeout config',
      sequenceNumber: 2,
      parentObservationId: obs1.observation.observationId,
      payload: { packageId: 'pkg-auth-context-1' },
    });

    // Step 3: FILE_MODIFICATION (AuthService.ts)
    const obs3 = await processor.process({
      taskId,
      sessionId,
      workspaceId,
      repositoryId,
      source: 'AGENT',
      type: 'FILE_MODIFICATION',
      summary: 'Modified login timeout configuration in AuthService.ts',
      sequenceNumber: 3,
      parentObservationId: obs2.observation.observationId,
      affectedResources: ['src/auth/AuthService.ts'],
      payload: { modifiedFiles: ['src/auth/AuthService.ts'], changeSummary: 'Increase timeout from 2s to 10s' },
    });

    // Step 4: BUILD_RESULT (build success)
    const obs4 = await processor.process({
      taskId,
      sessionId,
      workspaceId,
      repositoryId,
      source: 'AGENT',
      type: 'BUILD_RESULT',
      summary: 'TypeScript compilation passed',
      sequenceNumber: 4,
      parentObservationId: obs3.observation.observationId,
      payload: { success: true, exitCode: 0, durationMs: 450 },
    });

    // Step 5: TEST_RESULT (tests failed: timeout)
    const obs5 = await processor.process({
      taskId,
      sessionId,
      workspaceId,
      repositoryId,
      source: 'AGENT',
      type: 'TEST_RESULT',
      summary: 'Ran unit tests: 1 timeout test failed',
      sequenceNumber: 5,
      parentObservationId: obs4.observation.observationId,
      payload: {
        totalTests: 12,
        passed: 11,
        failed: 1,
        failures: [{ test: 'loginTimeoutTest', error: 'Expected 10000ms but received 5000ms' }],
      },
    });

    // Step 6: FILE_MODIFICATION (fix timeout constant)
    const obs6 = await processor.process({
      taskId,
      sessionId,
      workspaceId,
      repositoryId,
      source: 'AGENT',
      type: 'FILE_MODIFICATION',
      summary: 'Fixed default timeout constant in config',
      sequenceNumber: 6,
      parentObservationId: obs5.observation.observationId,
      affectedResources: ['src/config/auth.ts'],
      payload: { modifiedFiles: ['src/config/auth.ts'] },
    });

    // Step 7: BUILD_RESULT (build success)
    const obs7 = await processor.process({
      taskId,
      sessionId,
      workspaceId,
      repositoryId,
      source: 'AGENT',
      type: 'BUILD_RESULT',
      summary: 'Rebuilt project successfully',
      sequenceNumber: 7,
      parentObservationId: obs6.observation.observationId,
      payload: { success: true, exitCode: 0, durationMs: 410 },
    });

    // Step 8: VERIFICATION_PASSED (independent system verification runner reports pass)
    const obs8 = await processor.processVerificationReport(
      {
        taskId,
        passed: true,
        summary: 'All 12 authentication integration tests passed cleanly',
        testResults: [{ name: 'auth.test.ts', passed: true }],
      },
      'VERIFICATION'
    );
    expect(obs8.observation!.provenance).toBe('SYSTEM_VERIFIED');
    expect(obs8.observation!.type).toBe('VERIFICATION_PASSED');

    // Step 9: TASK_COMPLETED
    const obs9 = await processor.process({
      taskId,
      sessionId,
      workspaceId,
      repositoryId,
      source: 'AGENT',
      type: 'TASK_COMPLETED',
      summary: 'Task successfully completed and verified',
      sequenceNumber: 9,
      parentObservationId: obs8.observation!.observationId,
    });
    expect(obs9.observation!.targetTaskState).toBe('COMPLETED');

    // 10. Query & Timeline Verification
    const timeline = await queryService.getTaskTimeline(taskId);
    expect(timeline.totalObservations).toBe(9);
    expect(timeline.entries.length).toBe(9);

    // Verify Summary
    const summary = await queryService.getExecutionSummary(taskId);
    expect(summary.taskId).toBe(taskId);
    expect(summary.totalObservations).toBe(9);
    expect(summary.verificationResult?.passed).toBe(true);
    expect(summary.changedResources).toContain('src/auth/AuthService.ts');
    expect(summary.changedResources).toContain('src/config/auth.ts');
    expect(summary.conflictsDetected?.length).toBe(0);

    // Verify TaskRuntime state was updated
    expect(taskRuntime.updatedVerifications.length).toBe(1);
    expect(taskRuntime.updatedVerifications[0]?.payload.passed).toBe(true);
  });
});
