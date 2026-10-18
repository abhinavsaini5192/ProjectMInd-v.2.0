import { describe, it, expect } from 'vitest';
import { ObservationCorrelator } from '../../../src/agent/observation/correlators/ObservationCorrelator.js';
import { ObservationConflictResolver } from '../../../src/agent/observation/services/ObservationConflictResolver.js';
import { createMockObservation } from './ObservationTestHelper.js';

describe('ObservationCorrelator', () => {
  const conflictResolver = new ObservationConflictResolver();
  const correlator = new ObservationCorrelator(conflictResolver);

  it('correlates observations by explicit parentObservationId', () => {
    const parent = createMockObservation({ observationId: 'obs-parent-1', taskId: 'task-1' });
    const child = createMockObservation({
      observationId: 'obs-child-1',
      taskId: 'task-1',
      parentObservationId: 'obs-parent-1',
    });

    const result = correlator.correlate(child, [parent]);
    expect(result.correlatedObservationIds).toContain('obs-parent-1');
  });

  it('correlates observations sharing the same operationId', () => {
    const opId = 'op-build-and-test-99';
    const obs1 = createMockObservation({ observationId: 'obs-1', operationId: opId, taskId: 'task-1' });
    const obs2 = createMockObservation({ observationId: 'obs-2', operationId: opId, taskId: 'task-1' });

    const result = correlator.correlate(obs2, [obs1]);
    expect(result.correlatedObservationIds).toContain('obs-1');
  });

  it('correlates observations by overlapping affected resources', () => {
    const obs1 = createMockObservation({
      observationId: 'obs-1',
      taskId: 'task-1',
      affectedResources: ['src/auth/AuthService.ts'],
    });
    const obs2 = createMockObservation({
      observationId: 'obs-2',
      taskId: 'task-1',
      affectedResources: ['src/auth/AuthService.ts', 'src/auth/AuthController.ts'],
    });

    const result = correlator.correlate(obs2, [obs1]);
    expect(result.correlatedObservationIds).toContain('obs-1');
  });

  it('identifies conflict when an observation directly contradicts an existing one', () => {
    const passedObs = createMockObservation({
      observationId: 'obs-agent-pass',
      taskId: 'task-1',
      source: 'AGENT',
      type: 'VERIFICATION_PASSED',
      provenance: 'AGENT_REPORTED',
      payload: { passed: true, summary: 'Agent claims all tests passed' },
    });

    const failedObs = createMockObservation({
      observationId: 'obs-sys-fail',
      taskId: 'task-1',
      source: 'VERIFICATION',
      type: 'VERIFICATION_FAILED',
      provenance: 'SYSTEM_VERIFIED',
      payload: { passed: false, summary: 'Test runner failed 2 tests' },
    });

    const result = correlator.correlate(failedObs, [passedObs]);
    expect(result.conflictDetected).toBe(true);
    expect(result.conflict).toBeDefined();
    expect(result.conflict?.existingObservationId).toBe('obs-agent-pass');
    expect(result.conflict?.conflictingObservationId).toBe('obs-sys-fail');
  });
});
