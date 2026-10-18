import type { ITaskStore } from '../interfaces/ITaskStore.js';
import type { ITaskManager } from '../interfaces/ITaskManager.js';
import type { ITaskLifecycleManager } from '../interfaces/ITaskLifecycleManager.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';
import type {
  ITaskVerificationCoordinator,
  TaskVerificationReportParams,
  TaskVerificationReportResult,
} from '../interfaces/ITaskVerificationCoordinator.js';
import type { ScopeValidationParams } from '../interfaces/ITaskExecutionCoordinator.js';
import type {
  TaskVerificationState,
  VerificationStatus,
} from '../models/TaskVerificationState.js';
import {
  TaskNotFoundError,
  TaskScopeError,
} from '../errors/TaskRuntimeError.js';
import { TaskRuntimeEvents } from '../events/TaskRuntimeEvents.js';

export interface TaskVerificationCoordinatorDependencies {
  readonly store: ITaskStore;
  readonly taskManager: ITaskManager;
  readonly lifecycleManager?: ITaskLifecycleManager | undefined;
  readonly eventBus?: IEventBus | undefined;
}

export class TaskVerificationCoordinator implements ITaskVerificationCoordinator {
  constructor(private readonly deps: TaskVerificationCoordinatorDependencies) {}

  public async reportVerification(
    params: TaskVerificationReportParams,
    scope: ScopeValidationParams
  ): Promise<TaskVerificationReportResult> {
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
        const existingVerif = await this.getVerificationState(task.taskId);
        return {
          taskId: task.taskId,
          reportId: existingReportId,
          recorded: true,
          status: existingVerif.verificationState,
          verificationState: existingVerif,
          recordedAt: existingVerif.updatedAt.toISOString(),
        };
      }
    }

    const reportId = `rep_verif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = new Date();
    const verificationStatus: VerificationStatus = params.passed ? 'PASSED' : 'FAILED';

    // 3. Build sub-details
    const buildDetail = params.build
      ? {
          status: (params.build.passed ? 'PASSED' : 'FAILED') as VerificationStatus,
          details: params.build.details,
          timestamp: now,
        }
      : undefined;

    const testDetail =
      params.testCounts || params.testResults
        ? {
            status: ((params.testCounts?.failed ?? 0) === 0 && params.passed
              ? 'PASSED'
              : 'FAILED') as VerificationStatus,
            total: params.testCounts?.total,
            passed: params.testCounts?.passed,
            failed: params.testCounts?.failed,
            skipped: params.testCounts?.skipped,
            details: params.testResults,
            timestamp: now,
          }
        : undefined;

    const lintDetail = params.lintDiagnostics
      ? {
          status: (params.lintDiagnostics.length === 0 ? 'PASSED' : 'FAILED') as VerificationStatus,
          errorCount: params.lintDiagnostics.length,
          diagnostics: params.lintDiagnostics,
          timestamp: now,
        }
      : undefined;

    const typecheckDetail = params.typecheckDiagnostics
      ? {
          status: (params.typecheckDiagnostics.length === 0 ? 'PASSED' : 'FAILED') as VerificationStatus,
          errorCount: params.typecheckDiagnostics.length,
          diagnostics: params.typecheckDiagnostics,
          timestamp: now,
        }
      : undefined;

    const existingState = await this.deps.store.getVerificationState(task.taskId);
    const operationHistory = existingState?.operationHistory ? [...existingState.operationHistory] : [];
    if (params.operationId) {
      operationHistory.push(params.operationId);
      await this.deps.store.recordProcessedOperation(params.operationId, reportId);
    }

    const updatedVerifState: TaskVerificationState = {
      verificationState: verificationStatus,
      verificationSource: 'AGENT_REPORTED', // Trust boundary explicitly marked
      lastReportId: reportId,
      build: buildDetail ?? existingState?.build,
      tests: testDetail ?? existingState?.tests,
      lint: lintDetail ?? existingState?.lint,
      typecheck: typecheckDetail ?? existingState?.typecheck,
      diagnostics: params.diagnostics ?? [],
      summary: params.summary,
      updatedAt: now,
      operationHistory,
    };

    await this.deps.store.saveVerificationState(task.taskId, updatedVerifState);

    // 4. Update task state if appropriate
    if (task.status === 'IN_PROGRESS' && params.passed) {
      if (this.deps.lifecycleManager) {
        await this.deps.lifecycleManager.verify(task.taskId, scope.agentSessionId);
      }
    } else if (task.status === 'IN_PROGRESS' && !params.passed) {
      // Failed verification can transition to BLOCKED if desired
      if (this.deps.lifecycleManager) {
        await this.deps.lifecycleManager.block(
          task.taskId,
          `Verification failed: ${params.summary}`,
          scope.agentSessionId
        );
      }
    }

    await this.deps.store.recordTimeline(task.taskId, {
      event: `Verification reported: ${verificationStatus}`,
      timestamp: now,
      actor: scope.agentSessionId,
      details: {
        reportId,
        passed: params.passed,
        summary: params.summary,
        operationId: params.operationId,
        source: 'AGENT_REPORTED',
      },
    });

    if (this.deps.eventBus) {
      this.deps.eventBus.publish(TaskRuntimeEvents.TASK_VERIFICATION_REPORTED, {
        taskId: task.taskId,
        reportId,
        status: verificationStatus,
        passed: params.passed,
        source: 'AGENT_REPORTED',
        agentSessionId: scope.agentSessionId,
        workspaceId: scope.workspaceId,
        repositoryId: scope.repositoryId,
        timestamp: now.toISOString(),
      });
    }

    return {
      taskId: task.taskId,
      reportId,
      recorded: true,
      status: verificationStatus,
      verificationState: updatedVerifState,
      recordedAt: now.toISOString(),
    };
  }

  public async getVerificationState(taskId: string): Promise<TaskVerificationState> {
    const state = await this.deps.store.getVerificationState(taskId);
    if (!state) {
      return {
        verificationState: 'NOT_STARTED',
        verificationSource: 'UNKNOWN',
        diagnostics: [],
        updatedAt: new Date(),
        operationHistory: [],
      };
    }
    return state;
  }
}
