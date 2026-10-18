import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { PlanValidationResult } from '../models/PlanValidationResult.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { TaskPlanQuery } from './ITaskPlanStore.js';
import type { AdvancePlanResult } from './ITaskOrchestrator.js';

export interface CreatePlanRequest {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly repositoryIds?: readonly string[] | undefined;
  readonly title: string;
  readonly objective: string;
  readonly description?: string | undefined;
  readonly createdBy: string;
  readonly source?: string | undefined;
  readonly targetFeatures?: readonly string[] | undefined;
  readonly targetResources?: readonly string[] | undefined;
  readonly maxSteps?: number | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface ITaskPlannerService {
  createPlan(request: CreatePlanRequest): Promise<CanonicalTaskPlan>;
  getPlan(planId: string): Promise<CanonicalTaskPlan>;
  listPlans(query?: TaskPlanQuery | undefined): Promise<CanonicalTaskPlan[]>;
  validatePlan(planId: string): Promise<PlanValidationResult>;
  addNode(planId: string, node: TaskPlanNode): Promise<CanonicalTaskPlan>;
  removeNode(planId: string, nodeId: string): Promise<CanonicalTaskPlan>;
  getReadyNodes(planId: string): Promise<TaskPlanNode[]>;
  getBlockedNodes(planId: string): Promise<TaskPlanNode[]>;
  startPlan(planId: string): Promise<CanonicalTaskPlan>;
  pausePlan(planId: string, reason?: string): Promise<CanonicalTaskPlan>;
  resumePlan(planId: string): Promise<CanonicalTaskPlan>;
  cancelPlan(planId: string, reason?: string): Promise<CanonicalTaskPlan>;
  advancePlan(planId: string): Promise<AdvancePlanResult>;
  explainPlan(planId: string): Promise<Record<string, unknown>>;
}
