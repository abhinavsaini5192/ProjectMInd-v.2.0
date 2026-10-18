import type { TaskVerificationReportParams, TaskVerificationReportResult } from './ITaskVerificationCoordinator.js';
import type { ScopeValidationParams } from './ITaskExecutionCoordinator.js';

export interface TaskVerificationCheckResult {
  readonly canComplete: boolean;
  readonly passed: boolean;
  readonly missingConditions: readonly string[];
  readonly reasons: readonly string[];
  readonly details?: Record<string, unknown> | undefined;
}

export interface IAgentVerificationCoordinator {
  verifyTask(
    taskId: string,
    scope: ScopeValidationParams
  ): Promise<TaskVerificationCheckResult>;

  recordVerificationReport(
    params: TaskVerificationReportParams,
    scope: ScopeValidationParams
  ): Promise<TaskVerificationReportResult>;
}
