import type { AgentTask } from '../../context/models/AgentTask.js';
import type { TaskCompletionPolicy } from '../models/TaskCompletionPolicy.js';
import type { TaskCompletionValidationResult } from '../models/TaskCompletionValidationResult.js';

export interface ITaskCompletionValidator {
  validate(
    task: AgentTask,
    policy?: TaskCompletionPolicy | undefined,
    contextFreshness?: string | undefined
  ): Promise<TaskCompletionValidationResult>;
}
