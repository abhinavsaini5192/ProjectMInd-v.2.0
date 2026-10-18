import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskCheckpointManager,
  TaskPlanRevisionManager,
  InMemoryTaskPlanStore,
  CanonicalTaskPlan,
  TaskPlanNode,
  TaskPlanStatus,
  TaskNodeStatus,
  TaskType,
  TaskPriority,
  TaskRiskLevel
} from '../../../src/agent/planning/index.js';

describe('Phase 9.6 - Checkpoints, Revisions, and Replanning Tests', () => {
  let store: InMemoryTaskPlanStore;
  let checkpointManager: TaskCheckpointManager;
  let revisionManager: TaskPlanRevisionManager;

  beforeEach(() => {
    store = new InMemoryTaskPlanStore();
    checkpointManager = new TaskCheckpointManager(store);
    revisionManager = new TaskPlanRevisionManager(store);
  });

  const createDummyPlan = (): CanonicalTaskPlan => {
    const nodeA: TaskPlanNode = {
      id: 'task-1',
      planId: 'plan-ckpt-1',
      taskId: 'task-1',
      title: 'Task 1',
      objective: 'Do task 1',
      description: 'Desc 1',
      taskType: TaskType.ANALYSIS,
      status: TaskNodeStatus.COMPLETED,
      priority: TaskPriority.MEDIUM,
      risk: TaskRiskLevel.LOW,
      dependencies: [],
      requiredCapabilities: ['analysis'],
      affectedFeatures: ['core'],
      affectedResources: ['src/index.ts'],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const nodeB: TaskPlanNode = {
      id: 'task-2',
      planId: 'plan-ckpt-1',
      taskId: 'task-2',
      title: 'Task 2',
      objective: 'Do task 2',
      description: 'Desc 2',
      taskType: TaskType.IMPLEMENTATION,
      status: TaskNodeStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      risk: TaskRiskLevel.MEDIUM,
      dependencies: [{ targetNodeId: 'task-1', type: 'DEPENDS_ON' as any }],
      requiredCapabilities: ['code_generation'],
      affectedFeatures: ['core'],
      affectedResources: ['src/core.ts'],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    return {
      id: 'plan-ckpt-1',
      workspaceId: 'ws-1',
      projectId: 'proj-1',
      repositoryIds: ['repo-1'],
      rootTaskId: 'task-1',
      title: 'Checkpoint Plan',
      objective: 'Test checkpointing and revisions',
      status: TaskPlanStatus.RUNNING,
      version: 1,
      nodes: [nodeA, nodeB],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'tester',
      planRevision: 1
    };
  };

  describe('1. Checkpoint Manager', () => {
    it('should create an atomic checkpoint snapshot of a running plan', async () => {
      const plan = createDummyPlan();
      await store.savePlan(plan);

      const checkpoint = await checkpointManager.createCheckpoint(plan.id, 'Before risky database migration');
      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.planId).toBe(plan.id);
      expect(checkpoint.snapshot!.nodes).toHaveLength(2);
      expect(checkpoint.reason).toBe('Before risky database migration');

      const list = await checkpointManager.listCheckpoints(plan.id);
      expect(list).toHaveLength(1);
      expect(list[0]!.id).toBe(checkpoint.id);
    });

    it('should restore plan state from a previous checkpoint', async () => {
      const plan = createDummyPlan();
      await store.savePlan(plan);

      // Snapshot when Task 2 is IN_PROGRESS
      const checkpoint = await checkpointManager.createCheckpoint(plan.id, 'Stable snapshot');

      // Now mutate plan state: Task 2 fails and plan fails
      const mutatedPlan = (await store.getPlan(plan.id))!;
      (mutatedPlan.nodes[1] as { status: TaskNodeStatus }).status = TaskNodeStatus.FAILED;
      (mutatedPlan as { status: TaskPlanStatus }).status = TaskPlanStatus.FAILED;
      await store.savePlan(mutatedPlan);

      // Restore checkpoint
      const restored = await checkpointManager.restoreCheckpoint(plan.id, checkpoint.id);
      expect(restored.status).toBe(TaskPlanStatus.RUNNING);
      expect(restored.nodes[1].status).toBe(TaskNodeStatus.IN_PROGRESS);
    });
  });

  describe('2. Revision Manager & Replanning', () => {
    it('should record plan revisions and increment revision counter', async () => {
      const plan = createDummyPlan();
      await store.savePlan(plan);

      const rev = await revisionManager.createRevision(plan.id, {
        trigger: 'VERIFICATION_FAILURE',
        reason: 'Integration test failed, need extra refactoring step',
        author: 'lead-architect',
        modifiedNodes: ['task-2']
      });

      expect(rev.revisionNumber).toBe(2);
      expect(rev.trigger).toBe('VERIFICATION_FAILURE');

      const updatedPlan = await store.getPlan(plan.id);
      expect(updatedPlan?.planRevision).toBe(2);
      expect(updatedPlan?.version).toBe(2);

      const revisions = await revisionManager.listRevisions(plan.id);
      expect(revisions).toHaveLength(1);
    });

    it('should replan failed nodes by replacing them with revised tasks', async () => {
      const plan = createDummyPlan();
      await store.savePlan(plan);

      // Replan: replace task-2 with task-2-revised
      const replacementNode: TaskPlanNode = {
        id: 'task-2-revised',
        planId: plan.id,
        taskId: 'task-2-revised',
        title: 'Task 2 Revised with fallback auth',
        objective: 'Implement OAuth with fallback',
        description: 'Updated after verification error',
        taskType: TaskType.IMPLEMENTATION,
        status: TaskNodeStatus.PENDING,
        priority: TaskPriority.HIGH,
        risk: TaskRiskLevel.LOW,
        dependencies: [{ targetNodeId: 'task-1', type: 'DEPENDS_ON' as any }],
        requiredCapabilities: ['code_generation'],
        affectedFeatures: ['core'],
        affectedResources: ['src/core.ts'],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const replanned = await revisionManager.replan(
        plan.id,
        [plan.nodes[0], replacementNode],
        'Replaced task 2 with revised implementation'
      );

      expect(replanned.planRevision).toBe(2);
      expect(replanned.nodes.map(n => n.id)).toEqual(['task-1', 'task-2-revised']);
    });
  });
});
