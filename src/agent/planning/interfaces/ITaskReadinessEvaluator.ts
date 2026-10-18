import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { TaskNodeStatus } from '../models/TaskNodeStatus.js';

export interface NodeReadinessEvaluation {
  readonly nodeId: string;
  readonly status: TaskNodeStatus;
  readonly isReady: boolean;
  readonly unmetDependencies: readonly string[];
  readonly pendingApprovals: boolean;
  readonly missingContext: boolean;
  readonly reason: string;
}

export interface PlanReadinessSummary {
  readonly readyNodeIds: readonly string[];
  readonly waitingNodeIds: readonly string[];
  readonly blockedNodeIds: readonly string[];
  readonly completedNodeIds: readonly string[];
}

export interface ITaskReadinessEvaluator {
  evaluateNode(node: TaskPlanNode, plan: CanonicalTaskPlan): NodeReadinessEvaluation;
  evaluatePlan(plan: CanonicalTaskPlan): NodeReadinessEvaluation[];
  getReadyNodes(plan: CanonicalTaskPlan): TaskPlanNode[];
  getBlockedNodes(plan: CanonicalTaskPlan): TaskPlanNode[];
  evaluateNodeReadiness(plan: CanonicalTaskPlan, nodeId: string): Promise<NodeReadinessEvaluation>;
  evaluatePlanReadiness(plan: CanonicalTaskPlan): Promise<PlanReadinessSummary>;
}
