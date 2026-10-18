import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { TaskPlanAssignment } from '../models/TaskPlanAssignment.js';
import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';

export interface AssignmentResolutionResult {
  readonly assigned: boolean;
  readonly assignment?: TaskPlanAssignment | undefined;
  readonly reason?: string | undefined;
  readonly candidatesEvaluated: number;
}

export interface ITaskAssignmentResolver {
  resolveAssignment(node: TaskPlanNode, plan: CanonicalTaskPlan): Promise<AssignmentResolutionResult>;
  validateAssignment(node: TaskPlanNode, agentId: string, plan: CanonicalTaskPlan): Promise<boolean>;
}
