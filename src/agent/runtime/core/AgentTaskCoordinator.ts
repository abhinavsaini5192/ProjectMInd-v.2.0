import type { AgentTask } from '../../context/models/AgentTask.js';
import type { TaskStartResult } from '../models/TaskStartResult.js';
import type { StartTaskParams, CompleteTaskParams, CancelTaskParams, ITaskRuntime } from '../interfaces/ITaskRuntime.js';
import type { ScopeValidationParams } from '../interfaces/ITaskExecutionCoordinator.js';
import type { IAgentTaskCoordinator } from '../interfaces/IAgentTaskCoordinator.js';
import type { IAgentRuntimeTelemetry } from '../interfaces/IAgentRuntimeTelemetry.js';
import { RuntimeCapacityError } from '../errors/AgentRuntimeError.js';

export class AgentTaskCoordinator implements IAgentTaskCoordinator {
  private readonly activeTaskIds = new Set<string>();

  constructor(
    private readonly taskRuntime: ITaskRuntime,
    private readonly maxConcurrentTasks: number = 100,
    private readonly telemetry?: IAgentRuntimeTelemetry | undefined
  ) {}

  public async submitTask(params: StartTaskParams, scope: ScopeValidationParams): Promise<TaskStartResult> {
    if (this.activeTaskIds.size >= this.maxConcurrentTasks) {
      this.telemetry?.incrementRejectedRequests();
      throw new RuntimeCapacityError(
        'Cannot submit task: task capacity limit reached',
        'TASKS',
        this.maxConcurrentTasks,
        this.activeTaskIds.size
      );
    }

    const result = await this.taskRuntime.startTask(params, scope);
    this.activeTaskIds.add(result.task.taskId);
    this.telemetry?.updateActiveTasksGauge?.(this.activeTaskIds.size);
    return result;
  }

  public async getTask(taskId: string, scope: ScopeValidationParams): Promise<AgentTask | undefined> {
    return this.taskRuntime.getTask(taskId, scope);
  }

  public async cancelTask(params: CancelTaskParams, scope: ScopeValidationParams): Promise<AgentTask> {
    const task = await this.taskRuntime.cancelTask(params, scope);
    this.activeTaskIds.delete(params.taskId);
    this.telemetry?.updateActiveTasksGauge?.(this.activeTaskIds.size);
    return task;
  }

  public async completeTask(params: CompleteTaskParams, scope: ScopeValidationParams): Promise<AgentTask> {
    try {
      const task = await this.taskRuntime.completeTask(params, scope);
      this.activeTaskIds.delete(params.taskId);
      this.telemetry?.recordTaskCompleted();
      this.telemetry?.updateActiveTasksGauge?.(this.activeTaskIds.size);
      return task;
    } catch (err: unknown) {
      this.telemetry?.recordTaskFailed();
      throw err;
    }
  }

  public getActiveTaskCount(): number {
    return this.activeTaskIds.size;
  }
}
