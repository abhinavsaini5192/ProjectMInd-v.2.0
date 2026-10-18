import { describe, it, expect } from 'vitest';
import { FeedbackEngine } from '../../../src/intelligence/feedback/core/FeedbackEngine';
import { ActionPlan } from '../../../src/intelligence/planning/models/ActionPlan';

describe('Feedback: End-to-End Integration', () => {
  it('should orchestrate full outcome analysis, learning promotion, and Brain feedback payload', async () => {
    const feedbackEngine = new FeedbackEngine();

    const plan: ActionPlan = {
      planId: 'plan_integ_1',
      taskId: 'task_auth_fix',
      objective: 'Fix authentication token timeout bug',
      steps: [{
        stepId: 'step_1',
        order: 1,
        type: 'MODIFY',
        description: 'Extend token validity',
        reason: 'Fix timeout',
        target: { id: 'src/auth/AuthService.ts', type: 'FILE' },
        dependencies: [],
        preconditions: [],
        expectedOutcome: 'Token validity extended',
        riskLevel: 'LOW',
        validation: [],
        reversibility: 'REVERSIBLE',
      }],
      dependencies: [],
      preconditions: [],
      postconditions: [],
      risks: [],
      validationPlan: {
        validationId: 'v_integ',
        steps: ['Run tests'],
        requiredTests: ['Run tests'],
        typeCheck: true,
        architectureCheck: true,
        dependencyCheck: true,
      },
      affectedResources: ['src/auth/AuthService.ts'],
      status: 'APPROVED',
      estimatedComplexity: 'LOW',
      confidence: 1.0,
      knowledgeVersion: '1.0.0',
      contextVersion: '1.0.0',
      decisionId: 'decision_integ_1',
      reasoningId: 'reasoning_integ_1',
      createdAt: Date.now()
    };

    const execution = {
      executionId: 'exec_auth_success',
      status: 'SUCCEEDED' as any,
      changes: [{ path: 'src/auth/AuthService.ts', type: 'MODIFIED' }],
      succeeded: 1,
      failed: 0,
      errors: [],
      warnings: []
    };

    const { result, brainFeedback } = await feedbackEngine.processFeedback(execution, plan);

    expect(result.outcome.objectiveSuccess).toBe(true);
    expect(result.changes.symbolsChanged).toContain('sym_AuthService');
    expect(result.promotedLearning.length).toBeGreaterThan(0);
    expect(result.contextInvalidations).toContain('src/auth/AuthService.ts');
    expect(result.contextInvalidations).toContain('symbols_context');
    expect(brainFeedback.objectiveAchieved).toBe(true);
    expect(brainFeedback.suggestedAction).toBe('COMPLETE');
  });
});
