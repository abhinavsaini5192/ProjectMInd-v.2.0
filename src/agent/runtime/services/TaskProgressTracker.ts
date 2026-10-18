import type { AgentTask } from '../../context/models/AgentTask.js';
import type { TaskProgress } from '../models/TaskProgress.js';
import { STAGE_PROGRESS_PERCENTAGE } from '../models/TaskProgress.js';
import type { TaskRuntimeSummary } from '../models/TaskRuntimeSummary.js';
import type { ITaskStore } from '../interfaces/ITaskStore.js';
import type { ITaskProgressTracker } from '../interfaces/ITaskProgressTracker.js';
import type { ITaskCompletionValidator } from '../interfaces/ITaskCompletionValidator.js';
import { TaskNotFoundError } from '../errors/TaskRuntimeError.js';

export class TaskProgressTracker implements ITaskProgressTracker {
  constructor(
    private readonly store: ITaskStore,
    private readonly completionValidator?: ITaskCompletionValidator | undefined
  ) {}

  public async getProgress(taskId: string): Promise<TaskProgress> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const execState = await this.store.getExecutionState(taskId);
    const verifState = await this.store.getVerificationState(taskId);
    const timeline = await this.store.getTimeline(taskId);

    const completedSteps = timeline
      .map((entry) => entry.event)
      .filter((evt, idx, arr) => arr.indexOf(evt) === idx);

    let outstandingConditions: string[] = [];
    if (this.completionValidator && task.status !== 'COMPLETED') {
      const validation = await this.completionValidator.validate(task);
      outstandingConditions = Array.from(validation.missingConditions);
    }

    const stagePercentage = STAGE_PROGRESS_PERCENTAGE[task.status] ?? 0;

    return {
      taskId: task.taskId,
      currentState: task.status,
      completedSteps,
      executionState: execState?.executionState ?? 'NOT_STARTED',
      verificationState: verifState?.verificationState ?? 'NOT_STARTED',
      blocked: task.status === 'BLOCKED',
      blockedReason: task.blockedReason,
      lastActivity: task.updatedAt,
      outstandingConditions,
      stagePercentage,
    };
  }

  public async getSummary(taskId: string): Promise<TaskRuntimeSummary> {
    const task = await this.store.getTask(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    const execState = await this.store.getExecutionState(taskId);
    const verifState = await this.store.getVerificationState(taskId);
    const timeline = await this.store.getTimeline(taskId);

    const changedResources: string[] = [];
    if (execState?.lastChangeSet?.modifiedResources) {
      changedResources.push(...execState.lastChangeSet.modifiedResources);
    }
    if (execState?.lastChangeSet?.addedResources) {
      changedResources.push(...execState.lastChangeSet.addedResources);
    }

    const blockers: string[] = [];
    if (task.blockedReason) {
      blockers.push(task.blockedReason);
    }

    return {
      taskId: task.taskId,
      title: task.title,
      description: task.description,
      state: task.status,
      relevantFeatures: [],
      changedResources: Array.from(new Set(changedResources)),
      executionState: execState?.executionState ?? 'NOT_STARTED',
      verificationState: verifState?.verificationState ?? 'NOT_STARTED',
      blockers,
      contextFreshness: 'CURRENT',
      latestContextVersion: task.lastContextVersion ?? 1,
      latestKnowledgeVersion: task.lastKnowledgeVersion,
      recentTimeline: timeline.slice(-20),
    };
  }
}
