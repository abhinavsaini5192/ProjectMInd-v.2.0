import type {
  ITaskPlannerService,
  CreatePlanRequest,
} from '../interfaces/ITaskPlanner.js';
import type { ITaskPlanStore, TaskPlanQuery } from '../interfaces/ITaskPlanStore.js';
import type { ITaskDecomposer } from '../interfaces/ITaskDecomposer.js';
import type { ITaskPlanValidator } from '../interfaces/ITaskPlanValidator.js';
import type { ITaskDependencyResolver } from '../interfaces/ITaskDependencyResolver.js';
import type { ITaskReadinessEvaluator } from '../interfaces/ITaskReadinessEvaluator.js';
import type { ITaskPrioritizer } from '../interfaces/ITaskPrioritizer.js';
import type { IApprovalGateResolver } from '../interfaces/IApprovalGateResolver.js';
import type { ITaskOrchestrator, AdvancePlanResult } from '../interfaces/ITaskOrchestrator.js';
import type { ITaskCheckpointManager } from '../interfaces/ITaskCheckpointManager.js';
import type { ITaskPlanRevisionManager } from '../interfaces/ITaskPlanRevisionManager.js';
import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { PlanValidationResult } from '../models/PlanValidationResult.js';
import { PlanNotFoundError, PlanningError } from '../errors/PlanningError.js';
import { PlanningEventNames } from '../events/PlanningEvents.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';

export class TaskPlannerService implements ITaskPlannerService {
  constructor(
    public readonly store: ITaskPlanStore,
    public readonly decomposer: ITaskDecomposer,
    public readonly validator: ITaskPlanValidator,
    public readonly dependencyResolver: ITaskDependencyResolver,
    public readonly readinessEvaluator: ITaskReadinessEvaluator,
    public readonly prioritizer: ITaskPrioritizer,
    public readonly approvalGateResolver: IApprovalGateResolver,
    public readonly orchestrator: ITaskOrchestrator,
    public readonly checkpointManager?: ITaskCheckpointManager | undefined,
    public readonly revisionManager?: ITaskPlanRevisionManager | undefined,
    private readonly eventBus?: IEventBus | undefined
  ) {}

  public async createPlan(request: CreatePlanRequest): Promise<CanonicalTaskPlan> {
    if (!request.workspaceId || !request.projectId) {
      throw new PlanningError(
        'Both workspaceId and projectId are required to create a task plan.',
        'INVALID_SCOPE'
      );
    }
    if (!request.title || !request.objective) {
      throw new PlanningError(
        'Both title and objective are required to create a task plan.',
        'INVALID_INPUT'
      );
    }

    const now = Date.now();
    const planId = `plan_${now}_${Math.random().toString(36).substring(2, 8)}`;

    // 1. Decompose objective into ordered nodes
    const rawNodes = await this.decomposer.decompose({
      planId,
      workspaceId: request.workspaceId,
      projectId: request.projectId,
      repositoryIds: request.repositoryIds ?? ['default'],
      objective: request.objective,
      description: request.description,
      targetFeatures: request.targetFeatures,
      targetResources: request.targetResources,
      maxSteps: request.maxSteps,
      metadata: request.metadata,
    });

    // 2. Evaluate approval gates on nodes
    const processedNodes: TaskPlanNode[] = rawNodes.map((node) => {
      const approval = this.approvalGateResolver.evaluateApprovalRequirement(node);
      return {
        ...node,
        approval,
      };
    });

    const initialPlan: CanonicalTaskPlan = {
      id: planId,
      workspaceId: request.workspaceId,
      projectId: request.projectId,
      repositoryIds: request.repositoryIds ?? ['default'],
      title: request.title,
      objective: request.objective,
      description: request.description,
      status: 'PLANNING',
      version: 1,
      planRevision: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: request.createdBy,
      source: request.source ?? 'USER_REQUEST',
      provenance: 'SYSTEM_DECOMPOSED',
      confidence: 0.95,
      constraints: [],
      nodes: processedNodes,
      metadata: request.metadata,
    };

    // 3. Validate plan
    const validation = await this.validator.validate(initialPlan);
    const finalStatus = validation.valid ? 'READY' : 'PLANNING';

    const finalizedPlan: CanonicalTaskPlan = {
      ...initialPlan,
      status: finalStatus,
    };

    await this.store.savePlan(finalizedPlan);

    this.emitEvent(PlanningEventNames.PLAN_CREATED, finalizedPlan);
    if (validation.valid) {
      this.emitEvent(PlanningEventNames.PLAN_VALIDATED, finalizedPlan);
    } else {
      this.emitEvent(PlanningEventNames.PLAN_INVALIDATED, finalizedPlan);
    }

    return finalizedPlan;
  }

  public async getPlan(planId: string): Promise<CanonicalTaskPlan> {
    const plan = await this.store.getPlan(planId);
    if (!plan) {
      throw new PlanNotFoundError(planId);
    }
    return plan;
  }

  public async listPlans(query?: TaskPlanQuery): Promise<CanonicalTaskPlan[]> {
    return this.store.listPlans(query);
  }

  public async validatePlan(planId: string): Promise<PlanValidationResult> {
    const plan = await this.getPlan(planId);
    return this.validator.validate(plan);
  }

  public async addNode(planId: string, node: TaskPlanNode): Promise<CanonicalTaskPlan> {
    const plan = await this.getPlan(planId);
    const updatedNodes = [...plan.nodes, node];
    const updatedPlan: CanonicalTaskPlan = {
      ...plan,
      nodes: updatedNodes,
      updatedAt: Date.now(),
      version: plan.version + 1,
    };

    await this.store.savePlan(updatedPlan);
    this.emitEvent(PlanningEventNames.NODE_CREATED, updatedPlan, node);
    return updatedPlan;
  }

  public async removeNode(planId: string, nodeId: string): Promise<CanonicalTaskPlan> {
    const plan = await this.getPlan(planId);
    // Remove node and purge dependencies pointing to it
    const updatedNodes = plan.nodes
      .filter((n) => n.id !== nodeId)
      .map((n) => ({
        ...n,
        dependencies: n.dependencies.filter((d) => d.targetNodeId !== nodeId),
      }));

    const updatedPlan: CanonicalTaskPlan = {
      ...plan,
      nodes: updatedNodes,
      updatedAt: Date.now(),
      version: plan.version + 1,
    };

    await this.store.savePlan(updatedPlan);
    return updatedPlan;
  }

  public async getReadyNodes(planId: string): Promise<TaskPlanNode[]> {
    const plan = await this.getPlan(planId);
    return this.readinessEvaluator.getReadyNodes(plan);
  }

  public async getBlockedNodes(planId: string): Promise<TaskPlanNode[]> {
    const plan = await this.getPlan(planId);
    return this.readinessEvaluator.getBlockedNodes(plan);
  }

  public async startPlan(planId: string): Promise<CanonicalTaskPlan> {
    return this.orchestrator.startPlan(planId);
  }

  public async pausePlan(planId: string, reason?: string): Promise<CanonicalTaskPlan> {
    return this.orchestrator.pausePlan(planId, reason);
  }

  public async resumePlan(planId: string): Promise<CanonicalTaskPlan> {
    return this.orchestrator.resumePlan(planId);
  }

  public async cancelPlan(planId: string, reason?: string): Promise<CanonicalTaskPlan> {
    return this.orchestrator.cancelPlan(planId, reason);
  }

  public async advancePlan(planId: string): Promise<AdvancePlanResult> {
    return this.orchestrator.advancePlan(planId);
  }

  public async getReadyTasks(planId: string): Promise<TaskPlanNode[]> {
    return this.getReadyNodes(planId);
  }

  public async getBlockedTasks(planId: string): Promise<TaskPlanNode[]> {
    return this.getBlockedNodes(planId);
  }

  public async createCheckpoint(planId: string, description?: string): Promise<any> {
    if (!this.checkpointManager) {
      throw new Error('CheckpointManager not configured.');
    }
    return this.checkpointManager.createCheckpoint(planId, description);
  }

  public async recordTaskExecution(
    planId: string,
    nodeId: string,
    execution: { success: boolean; executionDurationMs?: number; artifacts?: any[]; error?: string }
  ): Promise<AdvancePlanResult> {
    return this.orchestrator.recordTaskExecution(planId, nodeId, execution);
  }

  public async recordVerificationResult(
    planId: string,
    nodeId: string,
    verification: { policy: string; passed: boolean; evidence?: string; failureReason?: string }
  ): Promise<AdvancePlanResult> {
    return this.orchestrator.recordVerificationResult(planId, nodeId, verification);
  }

  public async getPlanProgress(planId: string): Promise<{
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    failedTasks: number;
    percentComplete: number;
  }> {
    const plan = await this.getPlan(planId);
    const totalTasks = plan.nodes.length;
    const completedTasks = plan.nodes.filter((n) => n.status === 'COMPLETED').length;
    const inProgressTasks = plan.nodes.filter(
      (n) => n.status === 'IN_PROGRESS' || n.status === 'VERIFYING'
    ).length;
    const failedTasks = plan.nodes.filter((n) => n.status === 'FAILED').length;
    const percentComplete = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      failedTasks,
      percentComplete,
    };
  }

  public async explainPlan(planId: string): Promise<Record<string, unknown>> {
    const plan = await this.getPlan(planId);
    const analysis = this.dependencyResolver.analyzeDependencies(plan.nodes);
    const readyNodes = this.readinessEvaluator.getReadyNodes(plan);
    const blockedNodes = this.readinessEvaluator.getBlockedNodes(plan);

    const parallelGroups = this.dependencyResolver.getParallelizableNodes(
      plan.nodes,
      readyNodes.map((n) => n.id)
    );

    const readyExplanations = readyNodes.map((n) =>
      this.prioritizer.explainPriority(n, plan)
    );

    const blockedExplanations = blockedNodes.map((n) => {
      const evalRes = this.readinessEvaluator.evaluateNode(n, plan);
      return {
        nodeId: n.id,
        status: evalRes.status,
        reason: evalRes.reason,
        unmetDependencies: evalRes.unmetDependencies,
      };
    });

    return {
      planId: plan.id,
      title: plan.title,
      summary: `Task Plan '${plan.title}': ${plan.objective}`,
      status: plan.status,
      version: plan.version,
      planRevision: plan.planRevision,
      nodeCount: plan.nodes.length,
      rootTasks: analysis.rootNodeIds,
      leafTasks: analysis.leafNodeIds,
      criticalPath: analysis.criticalPathNodeIds,
      parallelGroups,
      readyTasks: readyExplanations,
      blockedTasks: blockedExplanations,
      nodes: plan.nodes,
    };
  }

  private emitEvent(name: string, plan: CanonicalTaskPlan, node?: TaskPlanNode): void {
    if (!this.eventBus) return;
    this.eventBus.publish(name, {
      planId: plan.id,
      workspaceId: plan.workspaceId,
      projectId: plan.projectId,
      nodeId: node?.id,
      taskId: node?.taskId,
      agentId: node?.assignment?.agentId,
      timestamp: Date.now(),
    });
  }
}
