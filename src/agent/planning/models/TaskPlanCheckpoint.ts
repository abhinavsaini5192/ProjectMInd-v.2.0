import type { TaskPlanStatus } from './TaskPlanStatus.js';
import type { TaskPlanNode } from './TaskPlanNode.js';

export interface TaskPlanCheckpoint {
  readonly checkpointId: string;
  readonly id?: string | undefined;
  readonly planId: string;
  readonly planVersion: number;
  readonly planRevision: number;
  readonly status: TaskPlanStatus;
  readonly nodesSnapshot: readonly TaskPlanNode[];
  readonly snapshot?: { readonly nodes: readonly TaskPlanNode[] } | undefined;
  readonly activeNodeIds: readonly string[];
  readonly completedNodeIds: readonly string[];
  readonly failedNodeIds: readonly string[];
  readonly contextVersion?: number | undefined;
  readonly knowledgeVersion?: number | undefined;
  readonly createdAt: number;
  readonly description?: string | undefined;
  readonly reason?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}
