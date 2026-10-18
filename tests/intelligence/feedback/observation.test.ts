import { describe, it, expect } from 'vitest';
import { ExecutionObserver } from '../../../src/intelligence/feedback/core/ExecutionObserver';
import { ChangeAnalyzer } from '../../../src/intelligence/feedback/core/ChangeAnalyzer';
import { ActionPlan } from '../../../src/intelligence/planning/models/ActionPlan';

describe('Feedback: Execution Observation & Change Detection', () => {
  it('should accurately capture changes, files created, modified, and deleted', () => {
    const observer = new ExecutionObserver();
    const changeAnalyzer = new ChangeAnalyzer();

    const plan: ActionPlan = {
      planId: 'plan_obs_1',
      taskId: 'task_obs_1',
      objective: 'Update auth and add tests',
      steps: [],
      dependencies: [],
      preconditions: [],
      postconditions: [],
      risks: [],
      validationPlan: {
        validationId: 'v1',
        steps: [],
        requiredTests: [],
        typeCheck: true,
        architectureCheck: true,
        dependencyCheck: true,
      },
      affectedResources: ['src/auth/AuthService.ts', 'src/auth/auth.test.ts'],
      status: 'APPROVED',
      estimatedComplexity: 'LOW',
      confidence: 1.0,
      knowledgeVersion: '1.0.0',
      contextVersion: '1.0.0',
      decisionId: 'decision_obs_1',
      reasoningId: 'reasoning_obs_1',
      createdAt: Date.now()
    };

    const observation = observer.observe({
      executionId: 'exec_123',
      status: 'SUCCEEDED' as any,
      changes: [
        { path: 'src/auth/AuthService.ts', type: 'MODIFIED' },
        { path: 'src/auth/auth.test.ts', type: 'CREATED' },
        { path: 'src/auth/old.ts', type: 'DELETED' }
      ],
      succeeded: 2,
      failed: 0,
      errors: [],
      warnings: []
    }, plan);

    expect(observation.changedFiles).toContain('src/auth/AuthService.ts');
    expect(observation.createdFiles).toContain('src/auth/auth.test.ts');
    expect(observation.deletedFiles).toContain('src/auth/old.ts');

    const changes = changeAnalyzer.analyzeChanges(observation);
    expect(changes.filesModified).toContain('src/auth/AuthService.ts');
    expect(changes.filesAdded).toContain('src/auth/auth.test.ts');
    expect(changes.symbolsChanged).toContain('sym_AuthService');
  });
});
