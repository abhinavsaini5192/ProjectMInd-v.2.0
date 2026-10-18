import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskOrchestrator,
  InMemoryTaskPlanStore,
  TaskPlanValidator,
  TaskDependencyResolver,
  TaskReadinessEvaluator,
  TaskAssignmentResolver,
  ApprovalGateResolver,
  TaskPlanStatus,
  TaskNodeStatus,
  TaskType,
  TaskPriority,
  TaskRiskLevel,
  TaskDependencyType,
  CanonicalTaskPlan,
  TaskPlanNode,
  PlanStateTransitionError
} from '../../../src/agent/planning/index.js';

describe('Phase 9.6 - Task Orchestration & Lifecycle State Machine Tests', () => {
  let store: InMemoryTaskPlanStore;
  let orchestrator: TaskOrchestrator;
  let validator: TaskPlanValidator;
  let dependencyResolver: TaskDependencyResolver;
  let readinessEvaluator: TaskReadinessEvaluator;
  let assignmentResolver: TaskAssignmentResolver;
  let approvalResolver: ApprovalGateResolver;

  beforeEach(() => {
    store = new InMemoryTaskPlanStore();
    validator = new TaskPlanValidator(store);
    dependencyResolver = new TaskDependencyResolver();
    readinessEvaluator = new TaskReadinessEvaluator();
    assignmentResolver = new TaskAssignmentResolver();
    approvalResolver = new ApprovalGateResolver();

    orchestrator = new TaskOrchestrator(
      store,
      validator,
      dependencyResolver,
      readinessEvaluator,
      assignmentResolver,
      approvalResolver
    );
  });

  const createTwoTaskPlan = (): CanonicalTaskPlan => {
    const nodeA: TaskPlanNode = {
      id: 'task-A',
      planId: 'plan-orch-1',
      taskId: 'task-A',
      title: 'Task A (Analysis)',
      objective: 'Analyze requirements',
      description: 'Analyze details',
      taskType: TaskType.ANALYSIS,
      status: TaskNodeStatus.PENDING,
      priority: TaskPriority.HIGH,
      risk: TaskRiskLevel.LOW,
      dependencies: [],
      requiredCapabilities: ['analysis'],
      affectedFeatures: ['auth'],
      affectedResources: ['doc/spec.md'],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const nodeB: TaskPlanNode = {
      id: 'task-B',
      planId: 'plan-orch-1',
      taskId: 'task-B',
      title: 'Task B (Implementation)',
      objective: 'Implement OAuth logic',
      description: 'Code the endpoint',
      taskType: TaskType.IMPLEMENTATION,
      status: TaskNodeStatus.PENDING,
      priority: TaskPriority.HIGH,
      risk: TaskRiskLevel.MEDIUM,
      dependencies: [
        {
          targetNodeId: 'task-A',
          type: TaskDependencyType.DEPENDS_ON
        }
      ],
      requiredCapabilities: ['code_generation'],
      affectedFeatures: ['auth'],
      affectedResources: ['src/oauth.ts'],
      verificationPolicy: {
        policies: ['UNIT_TEST'],
        requiresHumanApproval: false
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return {
      id: 'plan-orch-1',
      workspaceId: 'ws-1',
      projectId: 'proj-1',
      repositoryIds: ['repo-1'],
      rootTaskId: 'task-A',
      title: 'Orchestration Test Plan',
      objective: 'Test complete orchestration flow',
      status: TaskPlanStatus.DRAFT,
      version: 1,
      nodes: [nodeA, nodeB],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'test-architect',
      planRevision: 1
    };
  };

  it('should start a draft plan and transition it to RUNNING', async () => {
    const plan = createTwoTaskPlan();
    await store.savePlan(plan);

    const startedPlan = await orchestrator.startPlan(plan.id);
    expect(startedPlan.status).toBe(TaskPlanStatus.RUNNING);
  });

  it('should prevent starting an already COMPLETED plan', async () => {
    const plan = createTwoTaskPlan();
    (plan as { status: TaskPlanStatus }).status = TaskPlanStatus.COMPLETED;
    await store.savePlan(plan);

    await expect(orchestrator.startPlan(plan.id)).rejects.toThrow(PlanStateTransitionError);
  });

  it('should pause and resume a running plan', async () => {
    const plan = createTwoTaskPlan();
    await store.savePlan(plan);
    await orchestrator.startPlan(plan.id);

    const paused = await orchestrator.pausePlan(plan.id, 'Waiting for external review');
    expect(paused.status).toBe(TaskPlanStatus.PAUSED);

    const resumed = await orchestrator.resumePlan(plan.id);
    expect(resumed.status).toBe(TaskPlanStatus.RUNNING);
  });

  it('should cancel a plan with reason', async () => {
    const plan = createTwoTaskPlan();
    await store.savePlan(plan);

    const cancelled = await orchestrator.cancelPlan(plan.id, 'User changed requirements');
    expect(cancelled.status).toBe(TaskPlanStatus.CANCELLED);
  });

  it('should advance ready tasks and orchestrate the full dependency workflow', async () => {
    const plan = createTwoTaskPlan();
    await store.savePlan(plan);
    await orchestrator.startPlan(plan.id);

    // Initial advance: Task A has no dependencies, so it becomes READY and starts IN_PROGRESS
    const advance1 = await orchestrator.advancePlan(plan.id);
    expect(advance1.tasksStarted).toContain('task-A');

    // Report Task A completed (no verification required)
    await orchestrator.recordTaskExecution(plan.id, 'task-A', {
      success: true,
      executionDurationMs: 1200,
      artifacts: [
        {
          id: 'art-1',
          taskId: 'task-A',
          type: 'ANALYSIS_SPEC',
          name: 'OAuth Architecture Spec',
          content: 'Spec markdown...',
          version: 1,
          createdAt: Date.now()
        }
      ]
    });

    const updatedPlanAfterA = await store.getPlan(plan.id);
    const nodeA = updatedPlanAfterA?.nodes.find(n => n.id === 'task-A');
    expect(nodeA?.status).toBe(TaskNodeStatus.COMPLETED);

    // Advance 2: Now Task B dependencies are satisfied! Task B becomes READY and starts IN_PROGRESS
    const advance2 = await orchestrator.advancePlan(plan.id);
    expect(advance2.tasksStarted).toContain('task-B');

    // Agent executes Task B and reports success.
    // However, Task B has verificationPolicy: ['UNIT_TEST'].
    // Therefore, node must transition to VERIFYING, NOT COMPLETED!
    await orchestrator.recordTaskExecution(plan.id, 'task-B', {
      success: true,
      executionDurationMs: 3400
    });

    const planDuringVerif = await store.getPlan(plan.id);
    const nodeBDuringVerif = planDuringVerif?.nodes.find(n => n.id === 'task-B');
    expect(nodeBDuringVerif?.status).toBe(TaskNodeStatus.VERIFYING);

    // Provide verification report: test passed!
    await orchestrator.recordVerificationResult(plan.id, 'task-B', {
      policy: 'UNIT_TEST',
      passed: true,
      evidence: 'All 12 OAuth unit tests passed with 100% coverage.'
    });

    const planAfterVerif = await store.getPlan(plan.id);
    const nodeBAfterVerif = planAfterVerif?.nodes.find(n => n.id === 'task-B');
    expect(nodeBAfterVerif?.status).toBe(TaskNodeStatus.COMPLETED);

    // Advance 3: All tasks completed -> Plan transitions to COMPLETED
    const advance3 = await orchestrator.advancePlan(plan.id);
    expect(advance3.planCompleted).toBe(true);

    const finalPlan = await store.getPlan(plan.id);
    expect(finalPlan?.status).toBe(TaskPlanStatus.COMPLETED);
  });

  it('should handle verification failure and update task status', async () => {
    const plan = createTwoTaskPlan();
    await store.savePlan(plan);
    await orchestrator.startPlan(plan.id);

    // Start Task B
    const nodeB = plan.nodes.find(n => n.id === 'task-B')!;
    (nodeB as unknown as { dependencies: unknown[] }).dependencies = []; // simulate ready
    (nodeB as { status: TaskNodeStatus }).status = TaskNodeStatus.IN_PROGRESS;
    await store.savePlan(plan);

    // Agent reports success
    await orchestrator.recordTaskExecution(plan.id, 'task-B', { success: true });

    // Verification fails!
    await orchestrator.recordVerificationResult(plan.id, 'task-B', {
      policy: 'UNIT_TEST',
      passed: false,
      failureReason: 'OAuth callback timed out in test suite'
    });

    const planAfterFailedVerif = await store.getPlan(plan.id);
    const nodeBAfter = planAfterFailedVerif?.nodes.find(n => n.id === 'task-B');
    expect(nodeBAfter?.status).toBe(TaskNodeStatus.FAILED);
    expect(nodeBAfter?.error?.category).toBe('VERIFICATION_FAILURE');
  });
});
