import type { TaskPlanStatus } from './TaskPlanStatus.js';
import type { TaskPlanNode } from './TaskPlanNode.js';
import type { TaskConstraint } from './TaskConstraint.js';

export type PlanProvenance =
  | 'USER_REQUEST'
  | 'AGENT_GENERATED'
  | 'SYSTEM_DECOMPOSED'
  | 'REPLAN_TRIGGERED';

export interface CanonicalTaskPlan {
  readonly id: string; // unique plan ID (e.g. plan_123456789)
  readonly workspaceId: string;
  readonly projectId: string;
  readonly repositoryIds: readonly string[];
  readonly rootTaskId?: string | undefined;
  readonly title: string;
  readonly objective: string;
  readonly description?: string | undefined;
  readonly status: TaskPlanStatus;
  readonly version: number;
  readonly planRevision: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly createdBy: string;
  readonly source?: string | undefined;
  readonly provenance?: PlanProvenance | undefined;
  readonly confidence?: number | undefined;
  readonly constraints?: readonly TaskConstraint[] | undefined;
  readonly contextReference?: string | undefined;
  readonly nodes: readonly TaskPlanNode[];
  readonly activeNodeIds?: readonly string[] | undefined;
  readonly completedNodeIds?: readonly string[] | undefined;
  readonly failedNodeIds?: readonly string[] | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}
