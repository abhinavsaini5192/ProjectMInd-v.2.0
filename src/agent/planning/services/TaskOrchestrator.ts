import type {
  ITaskOrchestrator,
  AdvancePlanResult,
  TaskExecutionReport,
  TaskVerificationReport,
} from '../interfaces/ITaskOrchestrator.js';
import type { ITaskPlanStore } from '../interfaces/ITaskPlanStore.js';
import type { ITaskReadinessEvaluator } from '../interfaces/ITaskReadinessEvaluator.js';
import type { ITaskAssignmentResolver } from '../interfaces/ITaskAssignmentResolver.js';
import type { ITaskPrioritizer } from '../interfaces/ITaskPrioritizer.js';
import type { ITaskPlanValidator } from '../interfaces/ITaskPlanValidator.js';
import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import { PlanNotFoundError, TaskNodeNotFoundError, PlanStateTransitionError, PlanValidationError } from '../errors/PlanningError.js';
import { LEGAL_PLAN_TRANSITIONS } from '../models/TaskPlanStatus.js';
import { PlanningEventNames } from '../events/PlanningEvents.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';

import { TaskReadinessEvaluator } from './TaskReadinessEvaluator.js';
import { TaskAssignmentResolver } from './TaskAssignmentResolver.js';
import { TaskPrioritizer } from './TaskPrioritizer.js';
import { TaskDependencyResolver } from './TaskDependencyResolver.js';

export interface TaskOrchestratorDependencies {
  readonly store: ITaskPlanStore;
  readonly readinessEvaluator: ITaskReadinessEvaluator;
  readonly assignmentResolver: ITaskAssignmentResolver;
  readonly prioritizer: ITaskPrioritizer;
  readonly validator?: ITaskPlanValidator | undefined;
  readonly eventBus?: IEventBus | undefined;
}

export class TaskOrchestrator implements ITaskOrchestrator {
  private readonly deps: TaskOrchestratorDependencies;

  constructor(
    depsOrStore: TaskOrchestratorDependencies | ITaskPlanStore,
    validator?: ITaskPlanValidator,
    dependencyResolver?: any,
    readinessEvaluator?: ITaskReadinessEvaluator,
    assignmentResolver?: ITaskAssignmentResolver,
    _approvalResolver?: any
  ) {
    if (typeof (depsOrStore as any).getPlan === 'function') {
      const store = depsOrStore as ITaskPlanStore;
      const res = dependencyResolver ?? new TaskDependencyResolver();
      this.deps = {
        store,
        validator,
        readinessEvaluator: readinessEvaluator ?? new TaskReadinessEvaluator(),
        assignmentResolver: assignmentResolver ?? new TaskAssignmentResolver(),
        prioritizer: new TaskPrioritizer(res),
      };
    } else {
      this.deps = depsOrStore as TaskOrchestratorDependencies;
    }
  }

  public async startPlan(planId: string): Promise<CanonicalTaskPlan> {
    const plan = await this.deps.store.getPlan(planId);
    if (!plan) throw new PlanNotFoundError(planId);

    // Validate plan before starting if validator provided
    if (this.deps.validator) {
      const validation = await this.deps.validator.validate(plan);
      if (!validation.valid) {
        throw new PlanValidationError(`Cannot start invalid plan: ${validation.errors.join('; ')}`, {
          errors: validation.errors,
        });
      }
    }

    this.assertLegalTransition(plan.status, 'RUNNING');

    const updatedPlan: CanonicalTaskPlan = {
      ...plan,
      status: 'RUNNING',
      updatedAt: Date.now(),
      version: plan.version + 1,
    };

    await this.deps.store.savePlan(updatedPlan);
    this.emitEvent(PlanningEventNames.PLAN_RESUMED, updatedPlan);

    // Automatically trigger initial advance
    const advanceRes = await this.advancePlan(planId);
    return advanceRes.plan;
  }

  public async pausePlan(planId: string, reason?: string): Promise<CanonicalTaskPlan> {
    const plan = await this.deps.store.getPlan(planId);
    if (!plan) throw new PlanNotFoundError(planId);

    this.assertLegalTransition(plan.status, 'PAUSED');

    const updatedPlan: CanonicalTaskPlan = {
      ...plan,
      status: 'PAUSED',
      updatedAt: Date.now(),
      version: plan.version + 1,
      metadata: { ...plan.metadata, pauseReason: reason },
    };

    await this.deps.store.savePlan(updatedPlan);
    this.emitEvent(PlanningEventNames.PLAN_PAUSED, updatedPlan);
    return updatedPlan;
  }

  public async resumePlan(planId: string): Promise<CanonicalTaskPlan> {
    const plan = await this.deps.store.getPlan(planId);
    if (!plan) throw new PlanNotFoundError(planId);

    this.assertLegalTransition(plan.status, 'RUNNING');

    const updatedPlan: CanonicalTaskPlan = {
      ...plan,
      status: 'RUNNING',
      updatedAt: Date.now(),
      version: plan.version + 1,
    };

    await this.deps.store.savePlan(updatedPlan);
    this.emitEvent(PlanningEventNames.PLAN_RESUMED, updatedPlan);

    const advanceRes = await this.advancePlan(planId);
    return advanceRes.plan;
  }

  public async cancelPlan(planId: string, reason?: string): Promise<CanonicalTaskPlan> {
    const plan = await this.deps.store.getPlan(planId);
    if (!plan) throw new PlanNotFoundError(planId);

    this.assertLegalTransition(plan.status, 'CANCELLED');

    const updatedPlan: CanonicalTaskPlan = {
      ...plan,
      status: 'CANCELLED',
      updatedAt: Date.now(),
      version: plan.version + 1,
      metadata: { ...plan.metadata, cancelReason: reason },
    };

    await this.deps.store.savePlan(updatedPlan);
    return updatedPlan;
  }

  public async advancePlan(planId: string): Promise<AdvancePlanResult> {
    const plan = await this.deps.store.getPlan(planId);
    if (!plan) throw new PlanNotFoundError(planId);

    const now = Date.now();
    const updatedNodes: TaskPlanNode[] = [];

    // Evaluate readiness of every node
    for (const node of plan.nodes) {
      const evaluation = this.deps.readinessEvaluator.evaluateNode(node, plan);

      if (node.status === 'PENDING' || node.status === 'WAITING_FOR_DEPENDENCY' || node.status === 'WAITING_FOR_APPROVAL') {
        if (evaluation.isReady) {
          // Task transitioned to READY
          let readyNode: TaskPlanNode = {
            ...node,
            status: 'READY',
            updatedAt: now,
          };

          // If unassigned, resolve assignment automatically
          if (!readyNode.assignment) {
            const assignRes = await this.deps.assignmentResolver.resolveAssignment(readyNode, plan);
            if (assignRes.assigned && assignRes.assignment) {
              readyNode = {
                ...readyNode,
                assignment: assignRes.assignment,
              };
              this.emitEvent(PlanningEventNames.NODE_ASSIGNED, plan, readyNode);
            }
          }

          updatedNodes.push(readyNode);
          this.emitEvent(PlanningEventNames.NODE_READY, plan, readyNode);
        } else if (!evaluation.isReady && node.status !== evaluation.status) {
          updatedNodes.push({
            ...node,
            status: evaluation.status,
            updatedAt: now,
          });
          if (evaluation.status === 'BLOCKED' || evaluation.status === 'WAITING_FOR_DEPENDENCY') {
            this.emitEvent(PlanningEventNames.NODE_BLOCKED, plan, node);
          }
        } else {
          updatedNodes.push(node);
        }
      } else {
        updatedNodes.push(node);
      }
    }

    // Determine completion / failure statuses
    const completedNodeIds = updatedNodes.filter((n) => n.status === 'COMPLETED').map((n) => n.id);
    const failedNodeIds = updatedNodes.filter((n) => n.status === 'FAILED').map((n) => n.id);
    const readyNodes = updatedNodes.filter((n) => n.status === 'READY');
    const inProgressNodes = updatedNodes.filter((n) => n.status === 'IN_PROGRESS' || n.status === 'VERIFYING');

    let isPlanCompleted = false;
    let isPlanBlocked = false;
    let newPlanStatus = plan.status;

    if (completedNodeIds.length === updatedNodes.length && updatedNodes.length > 0) {
      isPlanCompleted = true;
      newPlanStatus = 'COMPLETED';
    } else if (failedNodeIds.length > 0 && readyNodes.length === 0 && inProgressNodes.length === 0) {
      newPlanStatus = 'FAILED';
    } else if (readyNodes.length === 0 && inProgressNodes.length === 0 && completedNodeIds.length < updatedNodes.length) {
      isPlanBlocked = true;
      if (newPlanStatus === 'RUNNING') {
        newPlanStatus = 'BLOCKED';
      }
    }

    const finalizedPlan: CanonicalTaskPlan = {
      ...plan,
      nodes: updatedNodes,
      status: newPlanStatus,
      activeNodeIds: readyNodes.map((n) => n.id),
      completedNodeIds,
      failedNodeIds,
      updatedAt: now,
      version: plan.version + 1,
    };

    await this.deps.store.savePlan(finalizedPlan);

    if (isPlanCompleted && plan.status !== 'COMPLETED') {
      this.emitEvent(PlanningEventNames.PLAN_COMPLETED, finalizedPlan);
    } else if (newPlanStatus === 'FAILED' && plan.status !== 'FAILED') {
      this.emitEvent(PlanningEventNames.PLAN_FAILED, finalizedPlan);
    }

    // Prioritize ready nodes before returning
    const prioritizedReadyNodes = this.deps.prioritizer.prioritize(readyNodes, finalizedPlan);

    return {
      plan: finalizedPlan,
      readyNodes: prioritizedReadyNodes,
      completedNodeIds,
      failedNodeIds,
      isPlanCompleted,
      isPlanBlocked,
      tasksStarted: prioritizedReadyNodes.map((n) => n.id),
      planCompleted: isPlanCompleted,
    };
  }

  public async reportTaskExecution(report: TaskExecutionReport): Promise<AdvancePlanResult> {
    const plan = await this.deps.store.getPlan(report.planId);
    if (!plan) throw new PlanNotFoundError(report.planId);

    const node = plan.nodes.find((n) => n.id === report.nodeId);
    if (!node) throw new TaskNodeNotFoundError(report.planId, report.nodeId);

    const now = Date.now();
    let updatedNode: TaskPlanNode;
    const isSuccess = report.status === 'SUCCESS' || report.success === true;

    if (isSuccess) {
      // If node requires verification, transition to VERIFYING; otherwise COMPLETED
      const hasVerificationPolicy =
        node.verificationPolicy &&
        ((node.verificationPolicy.requiredVerifications && node.verificationPolicy.requiredVerifications.length > 0) ||
          (node.verificationPolicy.policies && node.verificationPolicy.policies.length > 0));

      if (hasVerificationPolicy) {
        updatedNode = {
          ...node,
          status: 'VERIFYING',
          updatedAt: now,
        };
        this.emitEvent(PlanningEventNames.NODE_VERIFICATION_REQUIRED, plan, updatedNode);
      } else {
        updatedNode = {
          ...node,
          status: 'COMPLETED',
          updatedAt: now,
        };
        this.emitEvent(PlanningEventNames.NODE_COMPLETED, plan, updatedNode);
      }
    } else {
      // Execution failed
      const errorMsg = report.failureReason ?? report.error ?? 'Execution failed';
      const retryCount = node.retryCount ?? 0;
      const maxRetries = node.maxRetries ?? 3;

      if (retryCount < maxRetries) {
        updatedNode = {
          ...node,
          status: 'PENDING',
          retryCount: retryCount + 1,
          failureReason: errorMsg,
          error: { category: 'EXECUTION_FAILURE', message: errorMsg },
          updatedAt: now,
        };
      } else {
        updatedNode = {
          ...node,
          status: 'FAILED',
          failureReason: errorMsg,
          error: { category: 'EXECUTION_FAILURE', message: errorMsg },
          updatedAt: now,
        };
        this.emitEvent(PlanningEventNames.NODE_FAILED, plan, updatedNode);
      }
    }

    await this.deps.store.updateNode(report.planId, updatedNode);

    // Save any artifacts generated by task
    if (report.artifacts && report.artifacts.length > 0) {
      for (const artifact of report.artifacts) {
        await this.deps.store.saveArtifact(artifact);
      }
    }

    return this.advancePlan(report.planId);
  }

  public async reportTaskVerification(report: TaskVerificationReport): Promise<AdvancePlanResult> {
    const plan = await this.deps.store.getPlan(report.planId);
    if (!plan) throw new PlanNotFoundError(report.planId);

    const node = plan.nodes.find((n) => n.id === report.nodeId);
    if (!node) throw new TaskNodeNotFoundError(report.planId, report.nodeId);

    const now = Date.now();
    let updatedNode: TaskPlanNode;

    if (report.passed) {
      updatedNode = {
        ...node,
        status: 'COMPLETED',
        updatedAt: now,
      };
      this.emitEvent(PlanningEventNames.NODE_VERIFICATION_PASSED, plan, updatedNode);
      this.emitEvent(PlanningEventNames.NODE_COMPLETED, plan, updatedNode);
    } else {
      const reason = report.failureReason ?? 'Verification failed';
      updatedNode = {
        ...node,
        status: 'FAILED',
        failureReason: reason,
        error: { category: 'VERIFICATION_FAILURE', message: reason },
        updatedAt: now,
      };
      this.emitEvent(PlanningEventNames.NODE_VERIFICATION_FAILED, plan, updatedNode);
      this.emitEvent(PlanningEventNames.NODE_FAILED, plan, updatedNode);
    }

    await this.deps.store.updateNode(report.planId, updatedNode);
    return this.advancePlan(report.planId);
  }

  public async recordTaskExecution(
    planId: string,
    nodeId: string,
    execution: { success: boolean; executionDurationMs?: number; artifacts?: any[]; error?: string }
  ): Promise<AdvancePlanResult> {
    return this.reportTaskExecution({
      planId,
      nodeId,
      status: execution.success ? 'SUCCESS' : 'FAILURE',
      success: execution.success,
      executionDurationMs: execution.executionDurationMs,
      artifacts: execution.artifacts,
      error: execution.error,
    });
  }

  public async recordVerificationResult(
    planId: string,
    nodeId: string,
    verification: { policy: string; passed: boolean; evidence?: string; failureReason?: string }
  ): Promise<AdvancePlanResult> {
    return this.reportTaskVerification({
      planId,
      nodeId,
      passed: verification.passed,
      policy: verification.policy,
      evidence: verification.evidence,
      failureReason: verification.failureReason,
    });
  }

  private assertLegalTransition(from: string, to: string): void {
    const legalTargets = LEGAL_PLAN_TRANSITIONS[from as keyof typeof LEGAL_PLAN_TRANSITIONS] ?? [];
    if (!legalTargets.includes(to as any)) {
      throw new PlanStateTransitionError(from, to);
    }
  }

  private emitEvent(name: string, plan: CanonicalTaskPlan, node?: TaskPlanNode): void {
    if (!this.deps.eventBus) return;
    if (typeof this.deps.eventBus.publish === 'function') {
      this.deps.eventBus.publish(name, {
      planId: plan.id,
      workspaceId: plan.workspaceId,
      projectId: plan.projectId,
      nodeId: node?.id,
      taskId: node?.taskId,
      agentId: node?.assignment?.agentId,
      });
    }
  }
}
