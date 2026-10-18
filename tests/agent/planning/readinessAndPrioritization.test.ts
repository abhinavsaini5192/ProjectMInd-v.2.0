import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskReadinessEvaluator,
  TaskPrioritizer,
  TaskDependencyResolver,
  TaskNodeStatus,
  TaskType,
  TaskRiskLevel,
  TaskPriority,
  TaskPlanNode,
  TaskDependencyType,
  CanonicalTaskPlan,
  TaskPlanStatus,
  ApprovalStatus
} from '../../../src/agent/planning/index.js';

describe('Phase 9.6 - Readiness Evaluation & Prioritization Tests', () => {
  let readinessEvaluator: TaskReadinessEvaluator;
  let prioritizer: TaskPrioritizer;
  let dependencyResolver: TaskDependencyResolver;

  beforeEach(() => {
    dependencyResolver = new TaskDependencyResolver();
    readinessEvaluator = new TaskReadinessEvaluator();
    prioritizer = new TaskPrioritizer(dependencyResolver);
  });

  const createDummyNode = (
    id: string,
    status: TaskNodeStatus,
    deps: string[] = [],
    risk: TaskRiskLevel = TaskRiskLevel.LOW,
    priority: TaskPriority = TaskPriority.MEDIUM
  ): TaskPlanNode => ({
    id,
    planId: 'plan-ready-1',
    taskId: id,
    title: `Task ${id}`,
    objective: `Objective ${id}`,
    description: `Desc ${id}`,
    taskType: TaskType.IMPLEMENTATION,
    status,
    priority,
    risk,
    dependencies: deps.map(depId => ({
      targetNodeId: depId,
      type: TaskDependencyType.DEPENDS_ON
    })),
    requiredCapabilities: ['code_generation'],
    affectedFeatures: ['auth'],
    affectedResources: [`file_${id}.ts`],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  const createDummyPlan = (nodes: TaskPlanNode[]): CanonicalTaskPlan => ({
    id: 'plan-ready-1',
    workspaceId: 'ws-test',
    projectId: 'proj-test',
    repositoryIds: ['repo-1'],
    rootTaskId: nodes[0]?.id || 'root',
    title: 'Test Plan',
    objective: 'Test readiness objective',
    status: TaskPlanStatus.RUNNING,
    version: 1,
    nodes,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'tester',
    planRevision: 1
  });

  describe('1. Readiness Evaluation', () => {
    it('should mark node as READY when it has no dependencies and is PENDING', async () => {
      const nodeA = createDummyNode('A', TaskNodeStatus.PENDING, []);
      const plan = createDummyPlan([nodeA]);

      const evalResult = await readinessEvaluator.evaluateNodeReadiness(plan, 'A');
      expect(evalResult.status).toBe(TaskNodeStatus.READY);
      expect(evalResult.isReady).toBe(true);
      expect(evalResult.unmetDependencies).toHaveLength(0);
    });

    it('should mark node as WAITING_FOR_DEPENDENCY when its upstream is not COMPLETED', async () => {
      const nodeA = createDummyNode('A', TaskNodeStatus.IN_PROGRESS, []);
      const nodeB = createDummyNode('B', TaskNodeStatus.PENDING, ['A']);
      const plan = createDummyPlan([nodeA, nodeB]);

      const evalResult = await readinessEvaluator.evaluateNodeReadiness(plan, 'B');
      expect(evalResult.status).toBe(TaskNodeStatus.WAITING_FOR_DEPENDENCY);
      expect(evalResult.isReady).toBe(false);
      expect(evalResult.unmetDependencies).toContain('A');
    });

    it('should transition node to READY when all its upstream dependencies are COMPLETED', async () => {
      const nodeA = createDummyNode('A', TaskNodeStatus.COMPLETED, []);
      const nodeB = createDummyNode('B', TaskNodeStatus.PENDING, ['A']);
      const plan = createDummyPlan([nodeA, nodeB]);

      const evalResult = await readinessEvaluator.evaluateNodeReadiness(plan, 'B');
      expect(evalResult.status).toBe(TaskNodeStatus.READY);
      expect(evalResult.isReady).toBe(true);
      expect(evalResult.unmetDependencies).toHaveLength(0);
    });

    it('should mark node as WAITING_FOR_APPROVAL when an approval gate is required and pending', async () => {
      const nodeA = createDummyNode('A', TaskNodeStatus.PENDING, []);
      (nodeA as { verificationPolicy?: unknown }).verificationPolicy = {
        policies: [],
        requiresHumanApproval: true,
        approvalGateId: 'gate-1'
      };
      (nodeA as { approval?: unknown }).approval = {
        status: ApprovalStatus.APPROVAL_REQUIRED,
        requiredByPolicy: 'admin',
        createdAt: Date.now()
      };

      const plan = createDummyPlan([nodeA]);
      const evalResult = await readinessEvaluator.evaluateNodeReadiness(plan, 'A');
      expect(evalResult.status).toBe(TaskNodeStatus.WAITING_FOR_APPROVAL);
      expect(evalResult.isReady).toBe(false);
      expect(evalResult.reason).toContain('Approval required');
    });

    it('should partition ready, blocked, and waiting tasks across the entire plan', async () => {
      const nodeA = createDummyNode('A', TaskNodeStatus.COMPLETED, []);
      const nodeB = createDummyNode('B', TaskNodeStatus.PENDING, ['A']);
      const nodeC = createDummyNode('C', TaskNodeStatus.PENDING, ['B']);
      const plan = createDummyPlan([nodeA, nodeB, nodeC]);

      const planReadiness = await readinessEvaluator.evaluatePlanReadiness(plan);
      expect(planReadiness.readyNodeIds).toContain('B');
      expect(planReadiness.waitingNodeIds).toContain('C');
      expect(planReadiness.completedNodeIds).toContain('A');
    });
  });

  describe('2. Task Prioritization & Explainability', () => {
    it('should compute transparent priority scores and explain them', async () => {
      // Node A blocks B and C, so has high blocking impact
      const nodeA = createDummyNode('A', TaskNodeStatus.READY, [], TaskRiskLevel.CRITICAL, TaskPriority.CRITICAL);
      const nodeB = createDummyNode('B', TaskNodeStatus.PENDING, ['A'], TaskRiskLevel.LOW, TaskPriority.LOW);
      const nodeC = createDummyNode('C', TaskNodeStatus.PENDING, ['A'], TaskRiskLevel.LOW, TaskPriority.LOW);
      const plan = createDummyPlan([nodeA, nodeB, nodeC]);

      const explanation = await prioritizer.explainPriority(plan, 'A');
      expect(explanation.nodeId).toBe('A');
      expect(explanation.finalScore).toBeGreaterThan(0);
      expect(explanation.factors.blockingImpact).toBeGreaterThan(0);
      expect(explanation.factors.riskImpact).toBeGreaterThan(0);
      expect(explanation.rationale.length).toBeGreaterThan(0);

      const prioritizedNodes = await prioritizer.prioritize(plan);
      expect(prioritizedNodes[0].id).toBe('A'); // Highest score should be first
    });
  });
});
