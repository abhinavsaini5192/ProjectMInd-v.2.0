import type { ITaskStore } from '../interfaces/ITaskStore.js';
import type { ITaskManager } from '../interfaces/ITaskManager.js';
import type { ITaskLifecycleManager } from '../interfaces/ITaskLifecycleManager.js';
import type { IAgentContextSessionManager } from '../../context/interfaces/IAgentContextSessionManager.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import type {
  ITaskExecutionCoordinator,
  ScopeValidationParams,
  TaskExecutionReportParams,
  TaskExecutionReportResult,
} from '../interfaces/ITaskExecutionCoordinator.js';
import type { TaskExecutionState } from '../models/TaskExecutionState.js';
import { createEmptyChangeSet, type AgentChangeSet } from '../../context/models/AgentChangeSet.js';
import {
  TaskNotFoundError,
  TaskScopeError,
} from '../errors/TaskRuntimeError.js';
import { TaskRuntimeEvents } from '../events/TaskRuntimeEvents.js';

export interface TaskExecutionCoordinatorDependencies {
  readonly store: ITaskStore;
  readonly taskManager: ITaskManager;
  readonly lifecycleManager?: ITaskLifecycleManager | undefined;
  readonly contextSessionManager?: IAgentContextSessionManager | undefined;
  readonly eventBus?: IEventBus | undefined;
}

export class TaskExecutionCoordinator implements ITaskExecutionCoordinator {
  constructor(private readonly deps: TaskExecutionCoordinatorDependencies) {}

  public async reportExecution(
    params: TaskExecutionReportParams,
    scope: ScopeValidationParams
  ): Promise<TaskExecutionReportResult> {
    const task = await this.deps.taskManager.getTask(params.taskId);
    if (!task) {
      throw new TaskNotFoundError(params.taskId);
    }

    // 1. Validate Scope & Ownership
    if (task.workspaceId !== scope.workspaceId) {
      throw new TaskScopeError(
        `Workspace mismatch for task '${task.taskId}': task is in '${task.workspaceId}', request specified '${scope.workspaceId}'`
      );
    }
    if (task.repositoryId !== scope.repositoryId) {
      throw new TaskScopeError(
        `Repository mismatch for task '${task.taskId}': task is in '${task.repositoryId}', request specified '${scope.repositoryId}'`
      );
    }
    this.deps.taskManager.assertLeaseOrOwnership(task, scope.agentSessionId);

    // 2. Idempotency check
    if (params.operationId) {
      const existingReportId = await this.deps.store.getProcessedOperationReportId(params.operationId);
      if (existingReportId) {
        const existingExec = await this.getExecutionState(task.taskId);
        return {
          taskId: task.taskId,
          reportId: existingReportId,
          acknowledged: true,
          executionState: existingExec,
          recordedAt: existingExec.updatedAt.toISOString(),
        };
      }
    }

    const reportId = `rep_exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();

    // 3. Normalize ChangeSet & Resources
    let normalizedChangeSet: AgentChangeSet;
    if (params.changeSet) {
      normalizedChangeSet = params.changeSet;
    } else {
      const files = params.modifiedFiles ?? params.changedResources ?? [];
      normalizedChangeSet = {
        ...createEmptyChangeSet(),
        modifiedResources: Array.from(files),
      };
    }

    const changedFiles = [
      ...normalizedChangeSet.addedResources,
      ...normalizedChangeSet.modifiedResources,
      ...normalizedChangeSet.deletedResources,
      ...normalizedChangeSet.renamedResources.map((r) => r.newPath),
    ];

    // 4. Delegate impact & context invalidation to ContextSessionManager if available
    let invalidationDecision: string | undefined;
    const contextSessionId =
      task.contextSessionId || (task.metadata?.contextSessionId as string | undefined);
    if (this.deps.contextSessionManager && contextSessionId) {
      try {
        const result = await this.deps.contextSessionManager.reportExecution(
          {
            taskId: task.taskId,
            contextSessionId,
            status: params.status,
            summary: params.summary,
            modifiedFiles: changedFiles,
            changeSet: normalizedChangeSet,
            operations: params.operations,
            metadata: params.metadata,
          },
          {
            workspaceId: scope.workspaceId,
            repositoryId: scope.repositoryId,
            agentSessionId: scope.agentSessionId,
          }
        );
        invalidationDecision = result.invalidation.decision;
      } catch {
        // Fallback gracefully if context session lookup fails
      }
    }

    // 5. Update Task Execution State
    const existingState = await this.deps.store.getExecutionState(task.taskId);
    const operationHistory = existingState?.operationHistory ? [...existingState.operationHistory] : [];
    if (params.operationId) {
      operationHistory.push(params.operationId);
      await this.deps.store.recordProcessedOperation(params.operationId, reportId);
    }

    const updatedExecState: TaskExecutionState = {
      executionState: params.status,
      lastReportId: reportId,
      lastChangeSet: normalizedChangeSet,
      startedAt: existingState?.startedAt ?? now,
      completedAt: params.status === 'COMPLETED' ? now : existingState?.completedAt,
      updatedAt: now,
      summary: params.summary,
      operationHistory,
      evidenceLevel: (params.metadata?.evidenceLevel as string | undefined) ?? 'AGENT_REPORTED',
    };

    await this.deps.store.saveExecutionState(task.taskId, updatedExecState);

    // 6. Update task metadata and advance state if needed
    if (task.status === 'READY' || task.status === 'ANALYZING') {
      if (this.deps.lifecycleManager) {
        await this.deps.lifecycleManager.start(task.taskId, scope.agentSessionId);
      }
    }

    await this.deps.store.recordTimeline(task.taskId, {
      event: `Execution reported: ${params.status}`,
      timestamp: now,
      actor: scope.agentSessionId,
      details: {
        reportId,
        filesCount: changedFiles.length,
        summary: params.summary,
        operationId: params.operationId,
        invalidationDecision,
      },
    });

    if (this.deps.eventBus) {
      this.deps.eventBus.publish(TaskRuntimeEvents.TASK_EXECUTION_REPORTED, {
        taskId: task.taskId,
        reportId,
        status: params.status,
        changedFiles,
        agentSessionId: scope.agentSessionId,
        workspaceId: scope.workspaceId,
        repositoryId: scope.repositoryId,
        timestamp: now.toISOString(),
      });
    }

    return {
      taskId: task.taskId,
      reportId,
      acknowledged: true,
      executionState: updatedExecState,
      invalidationDecision,
      recordedAt: now.toISOString(),
    };
  }

  public async getExecutionState(taskId: string): Promise<TaskExecutionState> {
    const state = await this.deps.store.getExecutionState(taskId);
    if (!state) {
      return {
        executionState: 'NOT_STARTED',
        updatedAt: new Date(),
        operationHistory: [],
      };
    }
    return state;
  }
}
