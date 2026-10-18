import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskDependencyResolver,
  TaskDependencyType,
  TaskType,
  TaskNodeStatus,
  TaskRiskLevel,
  TaskPriority,
  CanonicalTaskPlan,
  TaskPlanNode,
  TaskPlanStatus
} from '../../../src/agent/planning/index.js';

describe('Phase 9.6 - Task Dependency Graph & Resolver Tests', () => {
  let resolver: TaskDependencyResolver;

  beforeEach(() => {
    resolver = new TaskDependencyResolver();
  });

  const createDummyNode = (
    id: string,
    dependencies: string[] = [],
    affectedResources: string[] = [],
    estimatedDurationMinutes: number = 30
  ): TaskPlanNode => ({
    id,
    planId: 'plan-test-1',
    taskId: id,
    title: `Task ${id}`,
    objective: `Objective ${id}`,
    description: `Desc ${id}`,
    taskType: TaskType.IMPLEMENTATION,
    status: TaskNodeStatus.PENDING,
    priority: TaskPriority.MEDIUM,
    risk: TaskRiskLevel.LOW,
    dependencies: dependencies.map(depId => ({
      targetNodeId: depId,
      type: TaskDependencyType.DEPENDS_ON
    })),
    requiredCapabilities: ['code_generation'],
    affectedFeatures: ['auth'],
    affectedResources,
    estimatedDurationMinutes,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  describe('1. Cycle Detection', () => {
    it('should confirm acyclic graph has no cycles', () => {
      const nodes: TaskPlanNode[] = [
        createDummyNode('A', []),
        createDummyNode('B', ['A']),
        createDummyNode('C', ['B'])
      ];

      const cycle = resolver.detectCycle(nodes);
      expect(cycle.hasCycle).toBe(false);
      expect(cycle.cyclePath).toHaveLength(0);
    });

    it('should detect a simple 2-node cycle: A -> B -> A', () => {
      const nodes: TaskPlanNode[] = [
        createDummyNode('A', ['B']),
        createDummyNode('B', ['A'])
      ];

      const cycle = resolver.detectCycle(nodes);
      expect(cycle.hasCycle).toBe(true);
      expect(cycle.cyclePath.length).toBeGreaterThanOrEqual(2);
    });

    it('should detect a 3-node cycle: A -> B -> C -> A', () => {
      const nodes: TaskPlanNode[] = [
        createDummyNode('A', ['C']),
        createDummyNode('B', ['A']),
        createDummyNode('C', ['B'])
      ];

      const cycle = resolver.detectCycle(nodes);
      expect(cycle.hasCycle).toBe(true);
      expect(cycle.cyclePath).toContain('A');
      expect(cycle.cyclePath).toContain('B');
      expect(cycle.cyclePath).toContain('C');
    });

    it('should detect self-referencing dependency cycle: A -> A', () => {
      const nodes: TaskPlanNode[] = [
        createDummyNode('A', ['A'])
      ];

      const cycle = resolver.detectCycle(nodes);
      expect(cycle.hasCycle).toBe(true);
      expect(cycle.cyclePath).toContain('A');
    });
  });

  describe('2. Topological Sort', () => {
    it('should order tasks so dependencies precede dependents', () => {
      const nodes: TaskPlanNode[] = [
        createDummyNode('C', ['B']),
        createDummyNode('A', []),
        createDummyNode('B', ['A'])
      ];

      const sorted = resolver.topologicalSort(nodes);
      const ids = sorted.map(n => n.id);
      expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('B'));
      expect(ids.indexOf('B')).toBeLessThan(ids.indexOf('C'));
    });

    it('should throw an error on topological sort if a cycle exists', () => {
      const nodes: TaskPlanNode[] = [
        createDummyNode('A', ['B']),
        createDummyNode('B', ['A'])
      ];

      expect(() => resolver.topologicalSort(nodes)).toThrow(/Cycle detected/i);
    });
  });

  describe('3. Critical Path Calculation', () => {
    it('should identify the longest dependency chain by duration', () => {
      // Path 1: A (10m) -> B (40m) = 50m
      // Path 2: A (10m) -> C (10m) = 20m
      const nodes: TaskPlanNode[] = [
        createDummyNode('A', [], [], 10),
        createDummyNode('B', ['A'], [], 40),
        createDummyNode('C', ['A'], [], 10)
      ];

      const criticalPath = resolver.getCriticalPath(nodes);
      expect(criticalPath).toEqual(['A', 'B']);
    });
  });

  describe('4. Parallelizable Node Grouping & Resource Conflict Isolation', () => {
    it('should group independent nodes that share no affected resources into parallel execution tiers', () => {
      const nodes: TaskPlanNode[] = [
        createDummyNode('A', [], ['src/auth/service.ts']),
        createDummyNode('B', [], ['src/ui/header.tsx']),
        createDummyNode('C', ['A'], ['src/auth/token.ts'])
      ];

      const groups = resolver.getParallelizableNodes(nodes);
      expect(groups.length).toBeGreaterThanOrEqual(1);

      // First parallel group should have A and B because they have no dependencies and disjoint resources
      const firstTierIds = groups[0].map(n => n.id);
      expect(firstTierIds).toContain('A');
      expect(firstTierIds).toContain('B');
      expect(firstTierIds).not.toContain('C');
    });

    it('should NOT allow two nodes modifying the same resource to run in the same parallel tier', () => {
      const nodes: TaskPlanNode[] = [
        createDummyNode('A', [], ['src/auth/service.ts']),
        createDummyNode('B', [], ['src/auth/service.ts']) // Same file conflict!
      ];

      const groups = resolver.getParallelizableNodes(nodes);
      // Because A and B conflict on 'src/auth/service.ts', they must not be in the same tier
      const firstTier = groups[0].map(n => n.id);
      expect(firstTier.length).toBe(1);
    });
  });
});
