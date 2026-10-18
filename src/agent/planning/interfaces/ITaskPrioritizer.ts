import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { TaskPriorityExplanation } from '../models/TaskPriorityExplanation.js';

export interface ITaskPrioritizer {
  prioritize(nodesOrPlan: readonly TaskPlanNode[] | CanonicalTaskPlan, plan?: CanonicalTaskPlan): TaskPlanNode[];
  explainPriority(
    nodeOrPlan: TaskPlanNode | CanonicalTaskPlan,
    planOrNodeId: CanonicalTaskPlan | string
  ): TaskPriorityExplanation;
}
