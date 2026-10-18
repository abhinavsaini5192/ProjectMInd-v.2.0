import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskAssignmentResolver,
  TaskPlanNode,
  CanonicalTaskPlan,
  TaskType,
  TaskNodeStatus,
  TaskRiskLevel,
  TaskPriority,
  TaskPlanStatus
} from '../../../src/agent/planning/index.js';
import type { IAgentRegistry } from '../../../src/agent/interfaces/IAgentRegistry.js';
import type { AgentRegistration } from '../../../src/agent/models/AgentRegistration.js';

describe('Phase 9.6 - Agent Assignment & Collaboration Integration Tests', () => {
  let mockRegistry: IAgentRegistry;
  let registeredAgents: AgentRegistration[];

  beforeEach(() => {
    registeredAgents = [
      {
        agentId: 'agent-coder-1',
        name: 'Lead Coder',
        role: 'IMPLEMENTER',
        status: 'ACTIVE',
        capabilities: ['code_generation', 'refactoring', 'unit_testing'],
        registeredAt: Date.now(),
        lastHeartbeat: Date.now()
      },
      {
        agentId: 'agent-reviewer-1',
        name: 'Security & Quality Reviewer',
        role: 'REVIEWER',
        status: 'ACTIVE',
        capabilities: ['security_review', 'static_analysis', 'verification'],
        registeredAt: Date.now(),
        lastHeartbeat: Date.now()
      },
      {
        agentId: 'agent-offline',
        name: 'Offline Worker',
        role: 'IMPLEMENTER',
        status: 'DRAINING',
        capabilities: ['code_generation'],
        registeredAt: Date.now(),
        lastHeartbeat: Date.now()
      }
    ];

    mockRegistry = {
      register: async () => {},
      unregister: async () => true,
      get: async (id: string) => registeredAgents.find(a => a.agentId === id) ?? null,
      list: async () => registeredAgents,
      heartbeat: async () => true,
      findByCapability: async (cap: string) => registeredAgents.filter(a => a.capabilities?.includes(cap)),
      updateStatus: async () => true
    } as unknown as IAgentRegistry;
  });

  const createDummyNode = (
    id: string,
    capabilities: string[],
    role?: string
  ): TaskPlanNode => ({
    id,
    planId: 'plan-assign-1',
    taskId: id,
    title: `Task ${id}`,
    objective: `Objective ${id}`,
    description: `Desc ${id}`,
    taskType: TaskType.IMPLEMENTATION,
    status: TaskNodeStatus.PENDING,
    priority: TaskPriority.HIGH,
    risk: TaskRiskLevel.LOW,
    dependencies: [],
    requiredCapabilities: capabilities,
    preferredAgentRole: role,
    affectedFeatures: ['core'],
    affectedResources: ['src/core.ts'],
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  const dummyPlan: CanonicalTaskPlan = {
    id: 'plan-assign-1',
    workspaceId: 'ws-1',
    projectId: 'proj-1',
    repositoryIds: ['repo-1'],
    rootTaskId: 'task-1',
    title: 'Assignment Plan',
    objective: 'Test assignment',
    status: TaskPlanStatus.READY,
    version: 1,
    nodes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    createdBy: 'test-user',
    planRevision: 1
  };

  it('should assign task to agent matching required capabilities', async () => {
    const resolver = new TaskAssignmentResolver(mockRegistry);
    const node = createDummyNode('node-1', ['code_generation', 'unit_testing'], 'IMPLEMENTER');

    const result = await resolver.resolveAssignment(node, dummyPlan);
    expect(result.assigned).toBe(true);
    expect(result.assignment?.agentId).toBe('agent-coder-1');
    expect(result.assignment?.role).toBe('IMPLEMENTER');
  });

  it('should assign security review task to agent with security capability', async () => {
    const resolver = new TaskAssignmentResolver(mockRegistry);
    const node = createDummyNode('node-sec', ['security_review', 'verification'], 'REVIEWER');

    const result = await resolver.resolveAssignment(node, dummyPlan);
    expect(result.assigned).toBe(true);
    expect(result.assignment?.agentId).toBe('agent-reviewer-1');
  });

  it('should not assign offline / non-active agents', async () => {
    const resolver = new TaskAssignmentResolver(mockRegistry);
    // Node requires capability that only agent-offline has
    registeredAgents = registeredAgents.filter(a => a.agentId === 'agent-offline');

    const node = createDummyNode('node-only-offline', ['code_generation']);
    const result = await resolver.resolveAssignment(node, dummyPlan);
    expect(result.assigned).toBe(false);
    expect(result.reason).toContain('No active agents available');
  });

  it('should fallback to default agent when running in standalone mode (no registry)', async () => {
    const resolver = new TaskAssignmentResolver(undefined);
    const node = createDummyNode('node-standalone', ['code_generation']);

    const result = await resolver.resolveAssignment(node, dummyPlan);
    expect(result.assigned).toBe(true);
    expect(result.assignment?.agentId).toBe('default_agent');
  });

  it('should validate whether an assigned agent has the required capabilities', async () => {
    const resolver = new TaskAssignmentResolver(mockRegistry);
    const node = createDummyNode('node-val', ['security_review']);

    const valid = await resolver.validateAssignment(node, 'agent-reviewer-1', dummyPlan);
    expect(valid).toBe(true);

    const invalid = await resolver.validateAssignment(node, 'agent-coder-1', dummyPlan);
    expect(invalid).toBe(false);
  });
});
