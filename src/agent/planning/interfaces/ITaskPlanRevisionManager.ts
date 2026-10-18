import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanRevision, RevisionTrigger } from '../models/TaskPlanRevision.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';

export interface CreateRevisionParams {
  readonly planId: string;
  readonly trigger: RevisionTrigger;
  readonly reason: string;
  readonly createdBy: string;
  readonly modifications?: {
    readonly addNodes?: readonly TaskPlanNode[] | undefined;
    readonly removeNodeIds?: readonly string[] | undefined;
    readonly updateNodes?: readonly TaskPlanNode[] | undefined;
  } | undefined;
}

export interface ITaskPlanRevisionManager {
  createRevision(
    paramsOrPlanId: CreateRevisionParams | string,
    options?: {
      readonly trigger: RevisionTrigger;
      readonly reason: string;
      readonly author?: string;
      readonly modifiedNodes?: readonly string[];
      readonly modifications?: CreateRevisionParams['modifications'];
    }
  ): Promise<any>;
  replanAfterFailure(
    planId: string,
    failedNodeId: string,
    errorReason: string,
    createdBy: string
  ): Promise<CanonicalTaskPlan>;
  replan(
    planId: string,
    newNodes: readonly TaskPlanNode[],
    reason: string,
    createdBy?: string
  ): Promise<CanonicalTaskPlan>;
  listRevisions(planId: string): Promise<readonly TaskPlanRevision[]>;
}
