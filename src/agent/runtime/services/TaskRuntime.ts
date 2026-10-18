import type { AgentTask } from '../../context/models/AgentTask.js';
import type { TaskStartResult } from '../models/TaskStartResult.js';
import type { TaskRuntimeSnapshot } from '../models/TaskRuntimeSnapshot.js';
import type { TaskProgress } from '../models/TaskProgress.js';
import type { TaskRuntimeSummary } from '../models/TaskRuntimeSummary.js';
import type { TaskFilterOptions } from '../interfaces/ITaskStore.js';
import type {
  ITaskRuntime,
  StartTaskParams,
  CompleteTaskParams,
  ResumeTaskParams,
  CancelTaskParams,
} from '../interfaces/ITaskRuntime.js';
import type { ITaskManager, UpdateTaskParams } from '../interfaces/ITaskManager.js';
import type { ITaskLifecycleManager } from '../interfaces/ITaskLifecycleManager.js';
import type {
  ITaskExecutionCoordinator,
  ScopeValidationParams,
  TaskExecutionReportParams,
  TaskExecutionReportResult,
} from '../interfaces/ITaskExecutionCoordinator.js';
import type {
  ITaskVerificationCoordinator,
  TaskVerificationReportParams,
  TaskVerificationReportResult,
} from '../interfaces/ITaskVerificationCoordinator.js';
import type {
  ITaskRecoveryManager,
  TaskRecoveryResult,
  SessionReconnectResult,
} from '../interfaces/ITaskRecoveryManager.js';
import type { ITaskProgressTracker } from '../interfaces/ITaskProgressTracker.js';
import type { ITaskCompletionValidator } from '../interfaces/ITaskCompletionValidator.js';
import type { IAgentContextSessionManager } from '../../context/interfaces/IAgentContextSessionManager.js';
import type { IAgentSessionManager } from '../../interfaces/IAgentSessionManager.js';
import {
  TaskNotFoundError,
  TaskScopeError,
  TaskCompletionValidationError,
} from '../errors/TaskRuntimeError.js';
import { TaskRecoveryManager } from './TaskRecoveryManager.js';

export interface TaskRuntimeDependencies {
  readonly taskManager: ITaskManager;
  readonly lifecycleManager: ITaskLifecycleManager;
  readonly executionCoordinator: ITaskExecutionCoordinator;
  readonly verificationCoordinator: ITaskVerificationCoordinator;
  readonly progressTracker: ITaskProgressTracker;
  readonly completionValidator: ITaskCompletionValidator;
  readonly recoveryManager: ITaskRecoveryManager;
  readonly contextSessionManager?: IAgentContextSessionManager | undefined;
  readonly agentSessionManager?: IAgentSessionManager | undefined;
}

export class TaskRuntime implements ITaskRuntime {
  constructor(private readonly deps: TaskRuntimeDependencies) {}

  public async startTask(
    params: StartTaskParams,
    scope: ScopeValidationParams
  ): Promise<TaskStartResult> {
    // 1. Validate Scope & Session
    this.assertScope(params.workspaceId, params.repositoryId, scope);
    await this.validateAgentSession(scope.agentSessionId, scope.workspaceId, scope.repositoryId);

    // 2. Create Task
    const initialTask = await this.deps.taskManager.createTask({
      taskId: params.taskId,
      contextSessionId: params.contextSessionId,
      agentSessionId: scope.agentSessionId,
      workspaceId: scope.workspaceId,
      repositoryId: scope.repositoryId,
      title: params.title,
      description: params.description,
      intent: params.intent,
      priority: params.priority,
      metadata: params.metadata,
    });

    // 3. Acquire Lease
    await this.deps.taskManager.acquireLease(
      initialTask.taskId,
      scope.agentSessionId,
      params.leaseDurationMs
    );

    // 4. Create or Resolve Context Session via ContextSessionManager
    let contextSession: any;
    let contextPackage: any;
    const warnings: string[] = [];
    let freshness = 'CURRENT';
    let contextVersion = 1;

    if (this.deps.contextSessionManager) {
      await this.deps.lifecycleManager.transition({
        taskId: initialTask.taskId,
        targetState: 'ANALYZING',
        actor: scope.agentSessionId,
      });

      const contextResult = await this.deps.contextSessionManager.startTaskContext({
        taskId: initialTask.taskId,
        agentSessionId: scope.agentSessionId,
        workspaceId: scope.workspaceId,
        repositoryId: scope.repositoryId,
        taskText: params.description,
        taskTitle: params.title,
        taskIntent: params.intent as any,
        featureIds: params.featureIds,
        resourceIds: params.resourceIds,
        changedResources: params.changedResources,
        tokenBudget: params.tokenBudget,
        requestedSections: params.requestedSections,
      });

      contextSession = contextResult.contextSession;
      contextPackage = contextResult.contextPackage;
      freshness = contextResult.freshness;
      contextVersion = contextResult.contextSession.currentContextVersion;
      warnings.push(...contextResult.warnings);

      // Transition to READY with context metadata
      await this.deps.lifecycleManager.transition({
        taskId: initialTask.taskId,
        targetState: 'READY',
        actor: scope.agentSessionId,
        contextSessionId: contextSession.contextSessionId,
        metadata: {
          contextSessionId: contextSession.contextSessionId,
          lastContextVersion: contextVersion,
        },
      });
    }

    // 5. Transition to IN_PROGRESS
    const runningTask = await this.deps.lifecycleManager.start(
      initialTask.taskId,
      scope.agentSessionId
    );

    return {
      task: runningTask,
      contextSession,
      contextPackage,
      state: 'IN_PROGRESS',
      warnings,
      freshness,
      contextVersion,
    };
  }

  public async getTask(
    taskId: string,
    scope: ScopeValidationParams
  ): Promise<AgentTask | undefined> {
    const task = await this.deps.taskManager.getTask(taskId);
    if (!task) return undefined;
    this.assertScope(task.workspaceId, task.repositoryId, scope);
    return task;
  }

  public async listTasks(
    filter: TaskFilterOptions,
    scope: ScopeValidationParams
  ): Promise<readonly AgentTask[]> {
    const effectiveFilter: TaskFilterOptions = {
      ...filter,
      workspaceId: scope.workspaceId,
      repositoryId: scope.repositoryId,
    };
    return this.deps.taskManager.listTasks(effectiveFilter);
  }

  public async updateTask(
    params: UpdateTaskParams,
    scope: ScopeValidationParams
  ): Promise<AgentTask> {
    const task = await this.deps.taskManager.getTask(params.taskId);
    if (!task) throw new TaskNotFoundError(params.taskId);
    this.assertScope(task.workspaceId, task.repositoryId, scope);
    this.deps.taskManager.assertLeaseOrOwnership(task, scope.agentSessionId);

    return this.deps.taskManager.updateTask(params);
  }

  public async getTaskRuntimeState(
    taskId: string,
    scope: ScopeValidationParams
  ): Promise<TaskRuntimeSnapshot> {
    const task = await this.deps.taskManager.getTask(taskId);
    if (!task) throw new TaskNotFoundError(taskId);
    this.assertScope(task.workspaceId, task.repositoryId, scope);

    if (this.deps.recoveryManager instanceof TaskRecoveryManager) {
      return this.deps.recoveryManager.buildSnapshot(task);
    }
    const recovery = await this.deps.recoveryManager.recoverTask(taskId, scope.agentSessionId);
    return recovery.snapshot;
  }

  public async getTaskProgress(
    taskId: string,
    scope: ScopeValidationParams
  ): Promise<TaskProgress> {
    const task = await this.deps.taskManager.getTask(taskId);
    if (!task) throw new TaskNotFoundError(taskId);
    this.assertScope(task.workspaceId, task.repositoryId, scope);

    return this.deps.progressTracker.getProgress(taskId);
  }

  public async getTaskSummary(
    taskId: string,
    scope: ScopeValidationParams
  ): Promise<TaskRuntimeSummary> {
    const task = await this.deps.taskManager.getTask(taskId);
    if (!task) throw new TaskNotFoundError(taskId);
    this.assertScope(task.workspaceId, task.repositoryId, scope);

    return this.deps.progressTracker.getSummary(taskId);
  }

  public async reportExecution(
    params: TaskExecutionReportParams,
    scope: ScopeValidationParams
  ): Promise<TaskExecutionReportResult> {
    return this.deps.executionCoordinator.reportExecution(params, scope);
  }

  public async reportVerification(
    params: TaskVerificationReportParams,
    scope: ScopeValidationParams
  ): Promise<TaskVerificationReportResult> {
    return this.deps.verificationCoordinator.reportVerification(params, scope);
  }

  public async completeTask(
    params: CompleteTaskParams,
    scope: ScopeValidationParams
  ): Promise<AgentTask> {
    const task = await this.deps.taskManager.getTask(params.taskId);
    if (!task) throw new TaskNotFoundError(params.taskId);
    this.assertScope(task.workspaceId, task.repositoryId, scope);
    this.deps.taskManager.assertLeaseOrOwnership(task, scope.agentSessionId);

    // 1. Completion Validation
    const validation = await this.deps.completionValidator.validate(task, params.policy);
    if (!validation.canComplete) {
      throw new TaskCompletionValidationError(
        task.taskId,
        validation.missingConditions,
        validation.reasons
      );
    }

    // 2. Lifecycle Transition to COMPLETED
    const completedTask = await this.deps.lifecycleManager.complete(
      task.taskId,
      scope.agentSessionId,
      params.expectedVersion
    );

    // 3. Finalize Context Session
    if (this.deps.contextSessionManager && completedTask.contextSessionId) {
      try {
        await this.deps.contextSessionManager.completeContextSession(
          completedTask.contextSessionId,
          scope
        );
      } catch {
        // Continue gracefully if context session is already finalized
      }
    }

    // 4. Release Lease
    await this.deps.taskManager.releaseLease(task.taskId, scope.agentSessionId);

    return completedTask;
  }

  public async resumeTask(
    params: ResumeTaskParams,
    scope: ScopeValidationParams
  ): Promise<AgentTask> {
    const task = await this.deps.taskManager.getTask(params.taskId);
    if (!task) throw new TaskNotFoundError(params.taskId);
    this.assertScope(task.workspaceId, task.repositoryId, scope);
    this.deps.taskManager.assertLeaseOrOwnership(task, scope.agentSessionId);

    const resumedTask = await this.deps.lifecycleManager.resume(
      task.taskId,
      scope.agentSessionId,
      params.expectedVersion
    );

    await this.deps.taskManager.acquireLease(task.taskId, scope.agentSessionId);
    return resumedTask;
  }

  public async cancelTask(
    params: CancelTaskParams,
    scope: ScopeValidationParams
  ): Promise<AgentTask> {
    const task = await this.deps.taskManager.getTask(params.taskId);
    if (!task) throw new TaskNotFoundError(params.taskId);
    this.assertScope(task.workspaceId, task.repositoryId, scope);
    this.deps.taskManager.assertLeaseOrOwnership(task, scope.agentSessionId);

    const cancelledTask = await this.deps.lifecycleManager.cancel(
      task.taskId,
      params.reason,
      scope.agentSessionId,
      params.expectedVersion
    );

    if (this.deps.contextSessionManager && cancelledTask.contextSessionId) {
      try {
        await this.deps.contextSessionManager.cancelContextSession(
          cancelledTask.contextSessionId,
          params.reason,
          scope
        );
      } catch {
        // Continue gracefully if context session is already finalized
      }
    }

    await this.deps.taskManager.releaseLease(task.taskId, scope.agentSessionId);
    return cancelledTask;
  }

  public async recoverTask(taskId: string, agentSessionId: string): Promise<TaskRecoveryResult> {
    return this.deps.recoveryManager.recoverTask(taskId, agentSessionId);
  }

  public async reconnectSession(agentSessionId: string): Promise<SessionReconnectResult> {
    return this.deps.recoveryManager.reconnectSession(agentSessionId);
  }

  private assertScope(
    taskWorkspaceId: string,
    taskRepositoryId: string,
    scope: ScopeValidationParams
  ): void {
    if (taskWorkspaceId !== scope.workspaceId) {
      throw new TaskScopeError(
        `Workspace mismatch: task is in '${taskWorkspaceId}', request scoped to '${scope.workspaceId}'`,
        { taskWorkspaceId, requestWorkspaceId: scope.workspaceId }
      );
    }
    if (taskRepositoryId !== scope.repositoryId) {
      throw new TaskScopeError(
        `Repository mismatch: task is in '${taskRepositoryId}', request scoped to '${scope.repositoryId}'`,
        { taskRepositoryId, requestRepositoryId: scope.repositoryId }
      );
    }
  }

  private async validateAgentSession(
    agentSessionId: string,
    workspaceId: string,
    repositoryId: string
  ): Promise<void> {
    if (!this.deps.agentSessionManager) return;
    const session = await this.deps.agentSessionManager.getSession(agentSessionId);
    if (!session) return;

    if (session.workspaceId !== workspaceId) {
      throw new TaskScopeError(
        `AgentSession workspaceId mismatch: session bound to '${session.workspaceId}', task scoped to '${workspaceId}'`,
        { sessionWorkspaceId: session.workspaceId, requestWorkspaceId: workspaceId }
      );
    }
    if (session.repositoryId !== repositoryId) {
      throw new TaskScopeError(
        `AgentSession repositoryId mismatch: session bound to '${session.repositoryId}', task scoped to '${repositoryId}'`,
        { sessionRepositoryId: session.repositoryId, requestRepositoryId: repositoryId }
      );
    }
  }
}
