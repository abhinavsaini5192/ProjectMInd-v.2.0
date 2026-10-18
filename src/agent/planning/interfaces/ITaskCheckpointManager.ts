import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanCheckpoint } from '../models/TaskPlanCheckpoint.js';

export interface ITaskCheckpointManager {
  createCheckpoint(planId: string, description?: string): Promise<TaskPlanCheckpoint>;
  restoreCheckpoint(checkpointId: string): Promise<CanonicalTaskPlan>;
  listCheckpoints(planId: string): Promise<TaskPlanCheckpoint[]>;
}
