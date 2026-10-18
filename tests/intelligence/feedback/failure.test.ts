import { describe, it, expect } from 'vitest';
import { FailureAnalyzer } from '../../../src/intelligence/feedback/core/FailureAnalyzer';
import { ExecutionObserver } from '../../../src/intelligence/feedback/core/ExecutionObserver';
import { ActionPlan } from '../../../src/intelligence/planning/models/ActionPlan';

describe('Feedback: Evidence-Based Failure Analysis', () => {
  const plan: ActionPlan = {
    planId: 'plan_fail_1',
    taskId: 'task_fail_1',
    objective: 'Test failure handling',
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
    affectedResources: [],
    status: 'APPROVED',
    estimatedComplexity: 'LOW',
    confidence: 1.0,
    knowledgeVersion: '1.0.0',
    contextVersion: '1.0.0',
    decisionId: 'decision_fail_1',
    reasoningId: 'reasoning_fail_1',
    createdAt: Date.now()
  };

  it('should identify transient network failure as ENVIRONMENT_FAILURE with retry recommendation', () => {
    const observer = new ExecutionObserver();
    const failureAnalyzer = new FailureAnalyzer();

    const obs = observer.observe({
      executionId: 'exec_net_err',
      status: 'FAILED' as any,
      errors: ['Network connection timeout to inference daemon (ECONNREFUSED)']
    }, plan);

    const analysis = failureAnalyzer.analyzeFailure(plan, obs);
    expect(analysis.failureType).toBe('ENVIRONMENT_FAILURE');
    expect(analysis.retryable).toBe(true);
    expect(analysis.recommendation).toBe('RETRY');
  });

  it('should identify syntax error as BUILD_FAILURE with replan recommendation', () => {
    const observer = new ExecutionObserver();
    const failureAnalyzer = new FailureAnalyzer();

    const obs = observer.observe({
      executionId: 'exec_syntax_err',
      status: 'FAILED' as any,
      errors: ['TypeScript compiler error: Unexpected token ; at src/index.ts:14']
    }, plan);

    const analysis = failureAnalyzer.analyzeFailure(plan, obs);
    expect(analysis.failureType).toBe('BUILD_FAILURE');
    expect(analysis.retryable).toBe(false);
    expect(analysis.recommendation).toBe('REPLAN');
  });
});
