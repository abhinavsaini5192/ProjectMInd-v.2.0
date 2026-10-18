import { describe, it, expect } from 'vitest';
import { ApprovalGuard } from '../../../src/intelligence/orchestration/guards/ApprovalGuard';
import { ActionPlan } from '../../../src/intelligence/planning/models/ActionPlan';
import { DEFAULT_ORCHESTRATION_POLICY } from '../../../src/intelligence/orchestration/policies/DefaultOrchestrationPolicy';

describe('Orchestration: Security & Approval Guards', () => {
  it('should require approval for plans containing destructive DELETE actions', () => {
    const guard = new ApprovalGuard();

    const plan: ActionPlan = {
      planId: 'plan_del_1',
      decisionId: 'decision_del_1',
      taskId: 'task_del_1',
      objective: 'Delete deprecated database migration',
      steps: [{
        stepId: 'step_delete',
        order: 1,
        type: 'DELETE',
        description: 'Delete migration file',
        reason: 'Clean up',
        target: { id: 'src/db/old.ts', type: 'FILE' },
        dependencies: [],
        preconditions: [],
        expectedOutcome: 'File deleted',
        riskLevel: 'HIGH',
        validation: [],
        reversibility: 'IRREVERSIBLE',
      }],
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
      affectedResources: ['src/db/old.ts'],
      status: 'NEEDS_APPROVAL',
      estimatedComplexity: 'LOW',
      confidence: 1.0,
      knowledgeVersion: '1.0.0',
      contextVersion: '1.0.0',
      reasoningId: 'reasoning_del_1',
      createdAt: Date.now()
    };

    const needsApproval = guard.requiresApproval(plan, DEFAULT_ORCHESTRATION_POLICY);
    expect(needsApproval).toBe(true);
  });
});
