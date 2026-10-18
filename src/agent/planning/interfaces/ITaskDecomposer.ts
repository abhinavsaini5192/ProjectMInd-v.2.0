import type { TaskPlanNode } from '../models/TaskPlanNode.js';

export interface TaskDecompositionRequest {
  readonly planId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly repositoryIds: readonly string[];
  readonly objective: string;
  readonly description?: string | undefined;
  readonly targetFeatures?: readonly string[] | undefined;
  readonly targetResources?: readonly string[] | undefined;
  readonly maxSteps?: number | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface ITaskDecomposer {
  decompose(request: TaskDecompositionRequest): Promise<TaskPlanNode[]>;
}
