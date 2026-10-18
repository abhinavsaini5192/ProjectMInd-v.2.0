import type { TaskVerificationState, VerificationStatus } from '../models/TaskVerificationState.js';
import type { ScopeValidationParams } from './ITaskExecutionCoordinator.js';

export interface TaskVerificationReportParams {
  readonly taskId: string;
  readonly passed: boolean;
  readonly summary: string;
  readonly build?: {
    readonly passed: boolean;
    readonly details?: string | undefined;
  } | undefined;
  readonly testResults?: readonly Record<string, unknown>[] | undefined;
  readonly testCounts?: {
    readonly total?: number | undefined;
    readonly passed?: number | undefined;
    readonly failed?: number | undefined;
    readonly skipped?: number | undefined;
  } | undefined;
  readonly lintDiagnostics?: readonly string[] | undefined;
  readonly typecheckDiagnostics?: readonly string[] | undefined;
  readonly diagnostics?: readonly string[] | undefined;
  readonly operationId?: string | undefined;
}

export interface TaskVerificationReportResult {
  readonly taskId: string;
  readonly reportId: string;
  readonly recorded: boolean;
  readonly status: VerificationStatus;
  readonly verificationState: TaskVerificationState;
  readonly recordedAt: string;
}

export interface ITaskVerificationCoordinator {
  reportVerification(
    params: TaskVerificationReportParams,
    scope: ScopeValidationParams
  ): Promise<TaskVerificationReportResult>;
  getVerificationState(taskId: string): Promise<TaskVerificationState>;
}
