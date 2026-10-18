import type { AgentTask } from '../../context/models/AgentTask.js';
import type { TaskExecutionState } from '../models/TaskExecutionState.js';
import type { TaskVerificationState } from '../models/TaskVerificationState.js';
import type { TaskLease } from '../models/TaskLease.js';
import type { TaskTimelineEntry } from '../models/TaskRuntimeSummary.js';
import type { ITaskStore, TaskFilterOptions } from '../interfaces/ITaskStore.js';

export class InMemoryTaskStore implements ITaskStore {
  private readonly tasks = new Map<string, AgentTask>();
  private readonly executionStates = new Map<string, TaskExecutionState>();
  private readonly verificationStates = new Map<string, TaskVerificationState>();
  private readonly leases = new Map<string, TaskLease>();
  private readonly timelines = new Map<string, TaskTimelineEntry[]>();
  private readonly processedOperations = new Map<string, string>(); // operationId -> reportId

  public async saveTask(task: AgentTask): Promise<void> {
    this.tasks.set(task.taskId, { ...task });
  }

  public async getTask(taskId: string): Promise<AgentTask | undefined> {
    const task = this.tasks.get(taskId);
    return task ? { ...task } : undefined;
  }

  public async listTasks(filter?: TaskFilterOptions | undefined): Promise<readonly AgentTask[]> {
    let result = Array.from(this.tasks.values());

    if (filter) {
      if (filter.workspaceId) {
        result = result.filter((t) => t.workspaceId === filter.workspaceId);
      }
      if (filter.repositoryId) {
        result = result.filter((t) => t.repositoryId === filter.repositoryId);
      }
      if (filter.agentSessionId) {
        result = result.filter((t) => t.agentSessionId === filter.agentSessionId);
      }
      if (filter.status) {
        result = result.filter((t) => t.status === filter.status);
      }
    }

    return result.map((t) => ({ ...t }));
  }

  public async deleteTask(taskId: string): Promise<boolean> {
    const deleted = this.tasks.delete(taskId);
    this.executionStates.delete(taskId);
    this.verificationStates.delete(taskId);
    this.leases.delete(taskId);
    this.timelines.delete(taskId);
    return deleted;
  }

  public async saveExecutionState(taskId: string, state: TaskExecutionState): Promise<void> {
    this.executionStates.set(taskId, { ...state });
  }

  public async getExecutionState(taskId: string): Promise<TaskExecutionState | undefined> {
    const state = this.executionStates.get(taskId);
    return state ? { ...state } : undefined;
  }

  public async saveVerificationState(taskId: string, state: TaskVerificationState): Promise<void> {
    this.verificationStates.set(taskId, { ...state });
  }

  public async getVerificationState(taskId: string): Promise<TaskVerificationState | undefined> {
    const state = this.verificationStates.get(taskId);
    return state ? { ...state } : undefined;
  }

  public async saveLease(lease: TaskLease): Promise<void> {
    this.leases.set(lease.taskId, { ...lease });
  }

  public async getLease(taskId: string): Promise<TaskLease | undefined> {
    const lease = this.leases.get(taskId);
    return lease ? { ...lease } : undefined;
  }

  public async deleteLease(taskId: string): Promise<boolean> {
    return this.leases.delete(taskId);
  }

  public async recordTimeline(taskId: string, entry: TaskTimelineEntry): Promise<void> {
    const list = this.timelines.get(taskId) ?? [];
    list.push({ ...entry });
    this.timelines.set(taskId, list);
  }

  public async getTimeline(taskId: string): Promise<readonly TaskTimelineEntry[]> {
    const list = this.timelines.get(taskId) ?? [];
    return list.map((e) => ({ ...e }));
  }

  public async recordProcessedOperation(operationId: string, reportId: string): Promise<void> {
    this.processedOperations.set(operationId, reportId);
  }

  public async getProcessedOperationReportId(operationId: string): Promise<string | undefined> {
    return this.processedOperations.get(operationId);
  }

  public async clear(): Promise<void> {
    this.tasks.clear();
    this.executionStates.clear();
    this.verificationStates.clear();
    this.leases.clear();
    this.timelines.clear();
    this.processedOperations.clear();
  }
}
