import { describe, it, expect } from 'vitest';
import { ObservationClassifier } from '../../../src/agent/observation/classifiers/ObservationClassifier.js';
import { createMockObservation } from './ObservationTestHelper.js';

describe('ObservationClassifier', () => {
  const classifier = new ObservationClassifier();

  it('classifies observation types into canonical categories', () => {
    expect(classifier.classifyCategory('COMMAND_EXECUTION')).toBe('COMMAND');
    expect(classifier.classifyCategory('BUILD_RESULT')).toBe('BUILD');
    expect(classifier.classifyCategory('TEST_RESULT')).toBe('TEST');
    expect(classifier.classifyCategory('LINT_RESULT')).toBe('LINT');
    expect(classifier.classifyCategory('TYPECHECK_RESULT')).toBe('TYPECHECK');
    expect(classifier.classifyCategory('DIAGNOSTICS_REPORTED')).toBe('DIAGNOSTICS');
    expect(classifier.classifyCategory('VERIFICATION_PASSED')).toBe('VERIFICATION');
    expect(classifier.classifyCategory('VERIFICATION_FAILED')).toBe('VERIFICATION');
    expect(classifier.classifyCategory('BLOCKER_ENCOUNTERED')).toBe('TASK');
    expect(classifier.classifyCategory('TASK_STARTED')).toBe('TASK');
    expect(classifier.classifyCategory('AGENT_DECISION')).toBe('AGENT');
  });

  it('determines target task state from observation types', () => {
    const blockerObs = createMockObservation({ type: 'BLOCKER_ENCOUNTERED' });
    expect(classifier.classifyTargetTaskState(blockerObs)).toBe('BLOCKED');

    const completedObs = createMockObservation({ type: 'TASK_COMPLETED' });
    expect(classifier.classifyTargetTaskState(completedObs)).toBe('COMPLETED');

    const failedObs = createMockObservation({ type: 'TASK_FAILED' });
    expect(classifier.classifyTargetTaskState(failedObs)).toBe('FAILED');

    const verifiedObs = createMockObservation({ type: 'VERIFICATION_PASSED' });
    expect(classifier.classifyTargetTaskState(verifiedObs)).toBe('VERIFIED');
  });

  it('extracts affected resources from observation payloads', () => {
    const obs = createMockObservation({
      type: 'BUILD_RESULT',
      affectedResources: ['src/index.ts'],
      payload: {
        modifiedFiles: ['src/services/AuthService.ts', 'src/controllers/AuthController.ts'],
        files: ['src/index.ts'],
      },
    });

    const resources = classifier.extractAffectedResources(obs);
    expect(resources).toContain('src/index.ts');
    expect(resources).toContain('src/services/AuthService.ts');
    expect(resources).toContain('src/controllers/AuthController.ts');
    expect(new Set(resources).size).toBe(resources.length); // Deduplicated
  });
});
