import { describe, it, expect, beforeEach } from 'vitest';
import {
  TaskPlannerService,
  InMemoryTaskPlanStore,
  TaskDecomposer,
  TaskDependencyResolver,
  TaskPlanValidator,
  TaskReadinessEvaluator,
  TaskPrioritizer,
  TaskAssignmentResolver,
  ApprovalGateResolver,
  TaskCheckpointManager,
  TaskPlanRevisionManager,
  TaskOrchestrator,
  TaskPlanStatus,
  TaskNodeStatus,
  TaskType
} from '../../../src/agent/planning/index.js';
import type { IAgentRegistry } from '../../../src/agent/interfaces/IAgentRegistry.js';
import type { AgentRegistration } from '../../../src/agent/models/AgentRegistration.js';

describe('Phase 9.6 - Section 34 End-to-End Orchestration Scenario', () => {
  let plannerService: TaskPlannerService;
  let store: InMemoryTaskPlanStore;
  let registeredAgents: AgentRegistration[];

  beforeEach(() => {
    store = new InMemoryTaskPlanStore();
    const decomposer = new TaskDecomposer();
    const dependencyResolver = new TaskDependencyResolver();
    const validator = new TaskPlanValidator(store);
    const readinessEvaluator = new TaskReadinessEvaluator();
    const prioritizer = new TaskPrioritizer(dependencyResolver);

    registeredAgents = [
      {
        agentId: 'agent-auth-specialist',
        name: 'Auth Implementer',
        role: 'IMPLEMENTER',
        status: 'ACTIVE',
        capabilities: ['code_generation', 'unit_testing', 'oauth_integration'],
        registeredAt: Date.now(),
        lastHeartbeat: Date.now()
      },
      {
        agentId: 'agent-qa-verifier',
        name: 'QA & Security Reviewer',
        role: 'REVIEWER',
        status: 'ACTIVE',
        capabilities: ['verification', 'security_review', 'integration_testing'],
        registeredAt: Date.now(),
        lastHeartbeat: Date.now()
      }
    ];

    const mockRegistry: IAgentRegistry = {
      register: async () => {},
      unregister: async () => true,
      get: async (id: string) => registeredAgents.find(a => a.agentId === id) ?? null,
      list: async () => registeredAgents,
      heartbeat: async () => true,
      findByCapability: async (cap: string) => registeredAgents.filter(a => a.capabilities?.includes(cap)),
      updateStatus: async () => true
    } as unknown as IAgentRegistry;

    const assignmentResolver = new TaskAssignmentResolver(mockRegistry);
    const approvalResolver = new ApprovalGateResolver();
    const checkpointManager = new TaskCheckpointManager(store);
    const revisionManager = new TaskPlanRevisionManager(store);

    const orchestrator = new TaskOrchestrator(
      store,
      validator,
      dependencyResolver,
      readinessEvaluator,
      assignmentResolver,
      approvalResolver
    );

    plannerService = new TaskPlannerService(
      store,
      decomposer,
      validator,
      dependencyResolver,
      readinessEvaluator,
      prioritizer,
      approvalResolver,
      orchestrator,
      checkpointManager,
      revisionManager
    );
  });

  it('should execute the full OAuth authentication planning & orchestration lifecycle', async () => {
    // 1. Create and decompose plan from high-level user request
    const plan = await plannerService.createPlan({
      workspaceId: 'ws-e2e',
      projectId: 'proj-oauth',
      repositoryIds: ['repo-backend'],
      title: 'Google OAuth Integration',
      objective: 'Add authentication with Google OAuth to the existing application',
      createdBy: 'lead-architect'
    });

    expect(plan.id).toBeDefined();
    expect(plan.status).toBe(TaskPlanStatus.READY);
    expect(plan.nodes.length).toBeGreaterThanOrEqual(5);

    // 2. Validate plan
    const valResult = await plannerService.validatePlan(plan.id);
    expect(valResult.valid).toBe(true);

    // 3. Inspect initial readiness: only root task(s) should be ready
    const readyInitially = await plannerService.getReadyTasks(plan.id);
    expect(readyInitially.length).toBeGreaterThanOrEqual(1);
    const blockedInitially = await plannerService.getBlockedTasks(plan.id);
    expect(blockedInitially.length).toBeGreaterThan(0);

    // 4. Start the plan
    const started = await plannerService.startPlan(plan.id);
    expect(started.status).toBe(TaskPlanStatus.RUNNING);

    // 5. Create pre-execution checkpoint
    const checkpoint = await plannerService.createCheckpoint(plan.id, 'Initial execution baseline');
    expect(checkpoint.id).toBeDefined();

    // 6. Orchestrator advance loop: advance tasks
    let advanceResult = await plannerService.advancePlan(plan.id);
    expect(advanceResult.tasksStarted.length).toBeGreaterThanOrEqual(1);

    // Work through tasks sequentially simulating external agent execution & reports
    let activePlan = (await plannerService.getPlan(plan.id))!;
    
    // Simulate completing all nodes step-by-step
    for (let iteration = 0; iteration < 15; iteration++) {
      activePlan = (await plannerService.getPlan(plan.id))!;
      if (activePlan.status === TaskPlanStatus.COMPLETED) {
        break;
      }

      // Check which tasks are currently IN_PROGRESS or VERIFYING
      for (const node of activePlan.nodes) {
        if (node.status === TaskNodeStatus.READY || node.status === TaskNodeStatus.IN_PROGRESS) {
          // Agent completes the task
          await plannerService.recordTaskExecution(plan.id, node.id, {
            success: true,
            executionDurationMs: 1500,
            artifacts: [
              {
                id: `art-${node.id}`,
                taskId: node.id,
                type: 'CODE_OR_SPEC',
                name: `Output for ${node.title}`,
                content: 'Artifact payload',
                version: 1,
                createdAt: Date.now()
              }
            ]
          });
        } else if (node.status === TaskNodeStatus.VERIFYING) {
          // Quality / Verification pass
          await plannerService.recordVerificationResult(plan.id, node.id, {
            policy: node.verificationPolicy?.policies?.[0] ?? 'UNIT_TEST',
            passed: true,
            evidence: 'Tests executed successfully with 100% pass rate.'
          });
        }
      }

      // Advance plan to unlock downstream tasks
      advanceResult = await plannerService.advancePlan(plan.id);
    }

    // 7. Verify final plan completion
    const finalPlan = (await plannerService.getPlan(plan.id))!;
    expect(finalPlan.status).toBe(TaskPlanStatus.COMPLETED);

    // All nodes should now be COMPLETED
    for (const node of finalPlan.nodes) {
      expect(node.status).toBe(TaskNodeStatus.COMPLETED);
    }

    // 8. Progress report
    const progress = await plannerService.getPlanProgress(plan.id);
    expect(progress.completedTasks).toBe(finalPlan.nodes.length);
    expect(progress.percentComplete).toBe(100);

    // 9. Explainability check
    const explanation = await plannerService.explainPlan(plan.id);
    expect(String(explanation.summary)).toContain('Google OAuth Integration');
    expect((explanation.nodes as unknown[]).length).toBe(finalPlan.nodes.length);
  });
});
