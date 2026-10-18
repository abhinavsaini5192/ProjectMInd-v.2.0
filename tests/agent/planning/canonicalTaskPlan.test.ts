import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskType,
  TaskPlanStatus,
  TaskNodeStatus,
  TaskDependencyType,
  TaskRiskLevel,
  TaskPriority,
  LEGAL_PLAN_TRANSITIONS,
  isLegalPlanTransition,
  TaskDecomposer,
  TaskPlanValidator,
  InMemoryTaskPlanStore,
  PlanValidationError,
  PlanStateTransitionError
} from '../../../src/agent/planning/index.js';

describe('Phase 9.6 - CanonicalTaskPlan & Decomposition Unit Tests', () => {
  let store: InMemoryTaskPlanStore;
  let decomposer: TaskDecomposer;
  let validator: TaskPlanValidator;

  beforeEach(() => {
    store = new InMemoryTaskPlanStore();
    decomposer = new TaskDecomposer();
    validator = new TaskPlanValidator(store);
  });

  describe('1. Task Taxonomy & State Transitions', () => {
    it('should support all standard TaskTypes', () => {
      expect(TaskType.ANALYSIS).toBe('ANALYSIS');
      expect(TaskType.RESEARCH).toBe('RESEARCH');
      expect(TaskType.DESIGN).toBe('DESIGN');
      expect(TaskType.IMPLEMENTATION).toBe('IMPLEMENTATION');
      expect(TaskType.REFACTOR).toBe('REFACTOR');
      expect(TaskType.CONFIGURATION).toBe('CONFIGURATION');
      expect(TaskType.DATABASE).toBe('DATABASE');
      expect(TaskType.API).toBe('API');
      expect(TaskType.UI).toBe('UI');
      expect(TaskType.TESTING).toBe('TESTING');
      expect(TaskType.VERIFICATION).toBe('VERIFICATION');
      expect(TaskType.DOCUMENTATION).toBe('DOCUMENTATION');
      expect(TaskType.SECURITY_REVIEW).toBe('SECURITY_REVIEW');
    });

    it('should validate legal plan transitions accurately', () => {
      expect(isLegalPlanTransition(TaskPlanStatus.DRAFT, TaskPlanStatus.PLANNING)).toBe(true);
      expect(isLegalPlanTransition(TaskPlanStatus.PLANNING, TaskPlanStatus.VALIDATING)).toBe(true);
      expect(isLegalPlanTransition(TaskPlanStatus.VALIDATING, TaskPlanStatus.READY)).toBe(true);
      expect(isLegalPlanTransition(TaskPlanStatus.READY, TaskPlanStatus.RUNNING)).toBe(true);
      expect(isLegalPlanTransition(TaskPlanStatus.RUNNING, TaskPlanStatus.PAUSED)).toBe(true);
      expect(isLegalPlanTransition(TaskPlanStatus.PAUSED, TaskPlanStatus.RUNNING)).toBe(true);
      expect(isLegalPlanTransition(TaskPlanStatus.RUNNING, TaskPlanStatus.COMPLETED)).toBe(true);
      
      // Illegal transitions
      expect(isLegalPlanTransition(TaskPlanStatus.DRAFT, TaskPlanStatus.COMPLETED)).toBe(false);
      expect(isLegalPlanTransition(TaskPlanStatus.COMPLETED, TaskPlanStatus.RUNNING)).toBe(false);
      expect(isLegalPlanTransition(TaskPlanStatus.CANCELLED, TaskPlanStatus.READY)).toBe(false);
    });
  });

  describe('2. Task Decomposition', () => {
    it('should decompose an OAuth authentication objective into structured steps', async () => {
      const plan = await decomposer.decomposePlan({
        workspaceId: 'ws-1',
        projectId: 'proj-1',
        repositoryIds: ['repo-1'],
        title: 'Add Google OAuth',
        objective: 'Add authentication with Google OAuth to the existing application',
        createdBy: 'user-lead'
      });

      expect(plan.id).toBeDefined();
      expect(plan.workspaceId).toBe('ws-1');
      expect(plan.projectId).toBe('proj-1');
      expect(plan.status).toBe(TaskPlanStatus.DRAFT);
      expect(plan.nodes.length).toBeGreaterThanOrEqual(5);

      // Check key steps
      const types = plan.nodes.map(n => n.taskType);
      expect(types).toContain(TaskType.ANALYSIS);
      expect(types).toContain(TaskType.DESIGN);
      expect(types).toContain(TaskType.IMPLEMENTATION);
      expect(types).toContain(TaskType.TESTING);
      expect(types).toContain(TaskType.VERIFICATION);

      // Verify dependencies link analysis -> design -> impl -> test -> verify
      const verifyNode = plan.nodes.find(n => n.taskType === TaskType.VERIFICATION);
      expect(verifyNode).toBeDefined();
      expect(verifyNode!.dependencies.length).toBeGreaterThan(0);
    });

    it('should decompose a database migration objective with approval gate requirement', async () => {
      const plan = await decomposer.decomposePlan({
        workspaceId: 'ws-1',
        projectId: 'proj-1',
        title: 'Add user preferences schema',
        objective: 'Add database schema and migration for user preferences table',
        createdBy: 'user-lead'
      });

      expect(plan.nodes.some(n => n.taskType === TaskType.DATABASE)).toBe(true);
      const dbNode = plan.nodes.find(n => n.taskType === TaskType.DATABASE);
      expect(dbNode?.risk).toBe(TaskRiskLevel.HIGH);
      expect(dbNode?.verificationPolicy?.requiresHumanApproval).toBe(true);
    });
  });

  describe('3. Plan Validation', () => {
    it('should validate a correctly constructed plan', async () => {
      const plan = await decomposer.decomposePlan({
        workspaceId: 'ws-1',
        projectId: 'proj-1',
        title: 'Simple feature',
        objective: 'Implement user avatar upload',
        createdBy: 'user-1'
      });

      const validation = await validator.validate(plan);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing dependency references', async () => {
      const plan = await decomposer.decomposePlan({
        workspaceId: 'ws-1',
        projectId: 'proj-1',
        title: 'Broken plan',
        objective: 'Some goal',
        createdBy: 'user-1'
      });

      // Inject a non-existent dependency ID
      (plan.nodes[1] as unknown as { dependencies: unknown[] }).dependencies = [
        ...plan.nodes[1]!.dependencies,
        {
          targetNodeId: 'non-existent-task-id-999',
          type: TaskDependencyType.DEPENDS_ON,
          description: 'Broken link'
        }
      ];

      const validation = await validator.validate(plan);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('non-existent-task-id-999'))).toBe(true);
    });

    it('should detect duplicate task node IDs', async () => {
      const plan = await decomposer.decomposePlan({
        workspaceId: 'ws-1',
        projectId: 'proj-1',
        title: 'Dup plan',
        objective: 'Some goal',
        createdBy: 'user-1'
      });

      const dupNode = { ...plan.nodes[0]! };
      (plan as unknown as { nodes: unknown[] }).nodes = [...plan.nodes, dupNode];

      const validation = await validator.validate(plan);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('Duplicate task node ID'))).toBe(true);
    });

    it('should detect empty workspaceId or projectId', async () => {
      const plan = await decomposer.decomposePlan({
        workspaceId: '',
        projectId: 'proj-1',
        title: 'Missing ws',
        objective: 'Some goal',
        createdBy: 'user-1'
      });

      const validation = await validator.validate(plan);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('workspaceId'))).toBe(true);
    });
  });
});
