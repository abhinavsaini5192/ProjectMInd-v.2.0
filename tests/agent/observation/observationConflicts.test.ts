import { describe, it, expect } from 'vitest';
import { createObservationTestHarness } from './ObservationTestHelper.js';

describe('Observation Conflicts & Precedence Resolution (Section 58)', () => {
  it('detects and resolves conflict between AGENT_REPORTED and SYSTEM_VERIFIED observations', async () => {
    const { processor, queryService, taskRuntime, eventBus } = createObservationTestHarness();
    const taskId = 'task-conflict-1';

    // Step 1: Agent reports that verification passed
    const agentReport = await processor.processVerificationReport(
      {
        taskId,
        passed: true,
        summary: 'Agent claims all tests passed cleanly',
        testResults: [{ name: 'auth.test.ts', passed: true }],
      },
      'AGENT'
    );

    expect(agentReport.observation!.provenance).toBe('AGENT_REPORTED');
    expect(agentReport.observation!.type).toBe('VERIFICATION_PASSED');
    expect(agentReport.conflictDetected).toBe(false);

    // Step 2: System verification runner runs independently and reports verification failed
    const systemReport = await processor.processVerificationReport(
      {
        taskId,
        passed: false,
        summary: 'System test runner failed: 2 assertion errors in auth.test.ts',
        testResults: [
          { name: 'auth.test.ts:testLoginTimeout', passed: false, error: 'Timeout after 5000ms' },
        ],
      },
      'VERIFICATION'
    );

    expect(systemReport.observation!.provenance).toBe('SYSTEM_VERIFIED');
    expect(systemReport.observation!.type).toBe('VERIFICATION_FAILED');
    expect(systemReport.conflictDetected).toBe(true);
    expect(systemReport.conflict).toBeDefined();

    // Step 3: Conflict details inspection
    const conflicts = await queryService.getObservationConflicts({ taskId });
    expect(conflicts.totalConflicts).toBe(1);
    const conflict = conflicts.conflicts[0]!;
    expect(conflict.taskId).toBe(taskId);
    expect(conflict.existingObservationId).toBe(agentReport.observation!.observationId);
    expect(conflict.conflictingObservationId).toBe(systemReport.observation!.observationId);
    expect(conflict.winnerObservationId).toBe(systemReport.observation!.observationId); // SYSTEM_VERIFIED wins!
    expect(conflict.resolutionStatus).toBe('RESOLVED');

    // Step 4: Verify non-destructive persistence: BOTH observations must be preserved
    const allObs = await queryService.getObservations({ taskId, workspaceId: 'default-workspace', repositoryId: 'default-repo' });
    expect(allObs.totalObservations).toBe(2);
    const ids = allObs.observations.map((o) => o.observationId);
    expect(ids).toContain(agentReport.observation!.observationId);
    expect(ids).toContain(systemReport.observation!.observationId);

    // Step 5: Verify TaskRuntime reflects verified failure, NOT agent claim
    expect(taskRuntime.updatedVerifications.length).toBe(2);
    const lastVerification = taskRuntime.updatedVerifications[1];
    expect(lastVerification?.payload.passed).toBe(false);

    // Step 6: Verify EventBus emitted conflict event
    const conflictEvents = eventBus.getEvents('observation.conflict_detected');
    expect(conflictEvents.length).toBe(1);
  });
});
