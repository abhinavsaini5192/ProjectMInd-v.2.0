import type { TaskProgress } from '../models/TaskProgress.js';
import type { TaskRuntimeSummary } from '../models/TaskRuntimeSummary.js';

export interface ITaskProgressTracker {
  getProgress(taskId: string): Promise<TaskProgress>;
  getSummary(taskId: string): Promise<TaskRuntimeSummary>;
}
