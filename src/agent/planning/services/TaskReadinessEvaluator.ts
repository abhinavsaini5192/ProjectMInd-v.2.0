import type {
  ITaskReadinessEvaluator,
  NodeReadinessEvaluation,
  PlanReadinessSummary,
} from '../interfaces/ITaskReadinessEvaluator.js';
import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { TaskNodeStatus } from '../models/TaskNodeStatus.js';

export class TaskReadinessEvaluator implements ITaskReadinessEvaluator {
  public evaluateNode(node: TaskPlanNode, plan: CanonicalTaskPlan): NodeReadinessEvaluation {
    // If node is already finalized, it is not ready for re-execution
    if (node.status === 'COMPLETED') {
      return {
        nodeId: node.id,
        status: 'COMPLETED',
        isReady: false,
        unmetDependencies: [],
        pendingApprovals: false,
        missingContext: false,
        reason: 'Task is already completed.',
      };
    }
    if (node.status === 'FAILED') {
      return {
        nodeId: node.id,
        status: 'FAILED',
        isReady: false,
        unmetDependencies: [],
        pendingApprovals: false,
        missingContext: false,
        reason: `Task failed: ${node.failureReason ?? 'unspecified error'}.`,
      };
    }
    if (node.status === 'CANCELLED') {
      return {
        nodeId: node.id,
        status: 'CANCELLED',
        isReady: false,
        unmetDependencies: [],
        pendingApprovals: false,
        missingContext: false,
        reason: 'Task is cancelled.',
      };
    }
    if (node.status === 'IN_PROGRESS' || node.status === 'VERIFYING') {
      return {
        nodeId: node.id,
        status: node.status,
        isReady: false,
        unmetDependencies: [],
        pendingApprovals: false,
        missingContext: false,
        reason: `Task is currently in progress (${node.status}).`,
      };
    }

    const unmetDependencies: string[] = [];

    // Check prerequisites
    for (const dep of node.dependencies) {
      const target = plan.nodes.find((n) => n.id === dep.targetNodeId);
      if (!target) {
        unmetDependencies.push(dep.targetNodeId);
        continue;
      }

      if (target.status !== 'COMPLETED') {
        unmetDependencies.push(dep.targetNodeId);
      }
    }

    if (unmetDependencies.length > 0) {
      return {
        nodeId: node.id,
        status: 'WAITING_FOR_DEPENDENCY',
        isReady: false,
        unmetDependencies,
        pendingApprovals: node.approval?.status === 'APPROVAL_REQUIRED',
        missingContext: false,
        reason: `Waiting for ${unmetDependencies.length} upstream dependencies: [${unmetDependencies.join(', ')}].`,
      };
    }

    // Check approval gate
    if (
      node.approval?.status === 'APPROVAL_REQUIRED' ||
      node.verificationPolicy?.requiresHumanApproval
    ) {
      return {
        nodeId: node.id,
        status: 'WAITING_FOR_APPROVAL',
        isReady: false,
        unmetDependencies: [],
        pendingApprovals: true,
        missingContext: false,
        reason: 'Approval required: human or security policy approval gate must be resolved before execution.',
      };
    }
    if (node.approval?.status === 'REJECTED') {
      return {
        nodeId: node.id,
        status: 'BLOCKED',
        isReady: false,
        unmetDependencies: [],
        pendingApprovals: false,
        missingContext: false,
        reason: `Task approval was rejected: ${node.approval?.rejectionReason ?? 'Policy rejection'}.`,
      };
    }

    // All conditions satisfied: READY
    return {
      nodeId: node.id,
      status: 'READY',
      isReady: true,
      unmetDependencies: [],
      pendingApprovals: false,
      missingContext: false,
      reason: 'All prerequisites, dependencies, and approval checks are satisfied.',
    };
  }

  public evaluatePlan(plan: CanonicalTaskPlan): NodeReadinessEvaluation[] {
    return plan.nodes.map((node) => this.evaluateNode(node, plan));
  }

  public getReadyNodes(plan: CanonicalTaskPlan): TaskPlanNode[] {
    return plan.nodes.filter((node) => this.evaluateNode(node, plan).isReady);
  }

  public getBlockedNodes(plan: CanonicalTaskPlan): TaskPlanNode[] {
    return plan.nodes.filter((node) => {
      const evalResult = this.evaluateNode(node, plan);
      return !evalResult.isReady && evalResult.status !== 'COMPLETED' && evalResult.status !== 'IN_PROGRESS';
    });
  }

  public async evaluateNodeReadiness(
    plan: CanonicalTaskPlan,
    nodeId: string
  ): Promise<NodeReadinessEvaluation> {
    const node = plan.nodes.find((n) => n.id === nodeId);
    if (!node) {
      throw new Error(`Node '${nodeId}' not found in plan '${plan.id}'.`);
    }
    return this.evaluateNode(node, plan);
  }

  public async evaluatePlanReadiness(
    plan: CanonicalTaskPlan
  ): Promise<PlanReadinessSummary> {
    const evaluations = this.evaluatePlan(plan);
    return {
      readyNodeIds: evaluations.filter((e) => e.isReady).map((e) => e.nodeId),
      waitingNodeIds: evaluations
        .filter((e) => e.status === 'WAITING_FOR_DEPENDENCY' || e.status === 'WAITING_FOR_APPROVAL')
        .map((e) => e.nodeId),
      blockedNodeIds: evaluations.filter((e) => e.status === 'BLOCKED').map((e) => e.nodeId),
      completedNodeIds: evaluations.filter((e) => e.status === 'COMPLETED').map((e) => e.nodeId),
    };
  }
}
