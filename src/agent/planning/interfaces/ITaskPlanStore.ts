import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { TaskPlanCheckpoint } from '../models/TaskPlanCheckpoint.js';
import type { TaskPlanRevision } from '../models/TaskPlanRevision.js';
import type { TaskArtifact } from '../models/TaskArtifact.js';

export interface TaskPlanQuery {
  readonly workspaceId?: string | undefined;
  readonly projectId?: string | undefined;
  readonly status?: string | undefined;
  readonly limit?: number | undefined;
}

export interface ITaskPlanStore {
  savePlan(plan: CanonicalTaskPlan): Promise<void>;
  getPlan(planId: string): Promise<CanonicalTaskPlan | null>;
  listPlans(query?: TaskPlanQuery | undefined): Promise<CanonicalTaskPlan[]>;
  deletePlan(planId: string): Promise<boolean>;

  updateNode(planId: string, node: TaskPlanNode): Promise<void>;
  getNode(planId: string, nodeId: string): Promise<TaskPlanNode | null>;

  saveCheckpoint(checkpoint: TaskPlanCheckpoint): Promise<void>;
  getCheckpoint(checkpointId: string): Promise<TaskPlanCheckpoint | null>;
  listCheckpoints(planId: string): Promise<TaskPlanCheckpoint[]>;

  saveRevision(revision: TaskPlanRevision): Promise<void>;
  listRevisions(planId: string): Promise<TaskPlanRevision[]>;

  saveArtifact(artifact: TaskArtifact): Promise<void>;
  listArtifacts(planId: string, nodeId?: string): Promise<TaskArtifact[]>;
}
