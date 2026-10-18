import { describe, it, expect } from 'vitest';
import { OutcomeAnalyzer } from '../../../src/intelligence/feedback/core/OutcomeAnalyzer';
import { ExecutionObserver } from '../../../src/intelligence/feedback/core/ExecutionObserver';
import { ActionPlan } from '../../../src/intelligence/planning/models/ActionPlan';

describe('Feedback: Outcome Analysis & Goal Evaluation', () => {
  it('should distinguish execution success from true objective goal achievement', () => {
    const observer = new ExecutionObserver();
    const outcomeAnalyzer = new OutcomeAnalyzer();

    const plan: ActionPlan = {
      planId: 'plan_goal_1',
      taskId: 'task_goal_1',
      objective: 'Fix timeout defect',
      steps: [
        {
          stepId: 's1',
          order: 1,
          type: 'MODIFY',
          description: 'Edit timeout',
          reason: 'Fix timeout',
          target: { id: 'src/auth.ts', type: 'FILE' },
          dependencies: [],
          preconditions: [],
          expectedOutcome: 'Timeout fixed',
          riskLevel: 'LOW',
          validation: [],
          reversibility: 'REVERSIBLE',
        },
      ],
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
      affectedResources: ['src/auth.ts'],
      status: 'APPROVED',
      estimatedComplexity: 'LOW',
      confidence: 1.0,
      knowledgeVersion: '1.0.0',
      contextVersion: '1.0.0',
      decisionId: 'decision_outcome_1',
      reasoningId: 'reasoning_outcome_1',
      createdAt: Date.now()
    };

    // Case 1: Execution command succeeded, but verification tests failed
    const observationPartial = observer.observe({
      executionId: 'exec_partial',
      status: 'SUCCEEDED' as any,
      changes: ['src/auth.ts'],
      succeeded: 1,
      failed: 1,
      errors: ['Test timeout still failed']
    }, plan);

    const outcome = outcomeAnalyzer.analyzeOutcome(plan, observationPartial);
    expect(outcome.executionSuccess).toBe(true);
    expect(outcome.objectiveSuccess).toBe(false);
    expect(outcome.goalEvaluation.goalStatus).toBe('PARTIALLY_ACHIEVED');
    expect(outcome.failureAnalysis?.failureType).toBe('TEST_FAILURE');
  });
});
