import type { AgentTask } from '../../context/models/AgentTask.js';
import type { TaskExecutionState } from '../models/TaskExecutionState.js';
import type { TaskVerificationState } from '../models/TaskVerificationState.js';
import {
  DEFAULT_TASK_COMPLETION_POLICY,
  type TaskCompletionPolicy,
} from '../models/TaskCompletionPolicy.js';
import type {
  TaskCompletionStatus,
  TaskCompletionValidationResult,
} from '../models/TaskCompletionValidationResult.js';
import type { ITaskStore } from '../interfaces/ITaskStore.js';
import type { ITaskCompletionValidator } from '../interfaces/ITaskCompletionValidator.js';
import type { IVerificationQueryService } from '../../../verification/interfaces/IVerificationQueryService.js';
import type { CompletionEvidence } from '../../../verification/models/CompletionEvidence.js';
import type { VerificationPolicy } from '../../../verification/policies/VerificationPolicy.js';

export class TaskCompletionValidator implements ITaskCompletionValidator {
  constructor(
    private readonly store: ITaskStore,
    private readonly verificationQueryService?: IVerificationQueryService | undefined
  ) {}

  public async validate(
    task: AgentTask,
    policy?: TaskCompletionPolicy | undefined,
    contextFreshness?: string | undefined
  ): Promise<TaskCompletionValidationResult> {
    const activePolicy = {
      ...DEFAULT_TASK_COMPLETION_POLICY,
      ...(policy ?? {}),
    };

    const missingConditions: string[] = [];
    const reasons: string[] = [];
    const evaluatedAt = new Date();
    let completionEvidence: CompletionEvidence | undefined;


    if (task.status === 'COMPLETED') {
      return {
        status: 'INVALID',
        canComplete: false,
        missingConditions: [],
        reasons: ['Task is already completed.'],
        evaluatedAt,
      };
    }

    if (task.status === 'CANCELLED') {
      return {
        status: 'INVALID',
        canComplete: false,
        missingConditions: [],
        reasons: ['Task has been cancelled.'],
        evaluatedAt,
      };
    }

    if (task.status === 'BLOCKED' && activePolicy.disallowBlockingErrors) {
      return {
        status: 'BLOCKED',
        canComplete: false,
        missingConditions: ['Task is currently BLOCKED.'],
        reasons: [task.blockedReason ? `Blocked reason: ${task.blockedReason}` : 'Task is in BLOCKED state.'],
        evaluatedAt,
      };
    }

    const executionState: TaskExecutionState | undefined =
      await this.store.getExecutionState(task.taskId);
    const verificationState: TaskVerificationState | undefined =
      await this.store.getVerificationState(task.taskId);

    // 1. Check execution state
    if (activePolicy.requireExecutionReportComplete) {
      if (!executionState || executionState.executionState !== 'COMPLETED') {
        const currentExec = executionState?.executionState ?? 'NOT_STARTED';
        missingConditions.push(`Execution report must be COMPLETED (current: ${currentExec})`);
        reasons.push(`Execution has not been reported complete by the external agent.`);
      }
    }

    // 2. Check verification report
    if (activePolicy.requireVerificationReport) {
      if (!verificationState || verificationState.verificationState === 'NOT_STARTED') {
        missingConditions.push('Verification report is required');
        reasons.push('No verification outcome has been reported for this task.');
      }
    }

    // 3. Check tests passed
    if (activePolicy.requireTestsPassed) {
      const testStatus = verificationState?.tests?.status ?? verificationState?.verificationState;
      if (testStatus !== 'PASSED') {
        missingConditions.push(`Tests must pass (current: ${testStatus ?? 'UNKNOWN'})`);
        reasons.push('Reported test outcome is not PASSED.');
      }
    }

    // 4. Check build passed
    if (activePolicy.requireBuildPassed) {
      const buildStatus = verificationState?.build?.status ?? verificationState?.verificationState;
      if (buildStatus !== 'PASSED') {
        missingConditions.push(`Build must pass (current: ${buildStatus ?? 'UNKNOWN'})`);
        reasons.push('Reported build outcome is not PASSED.');
      }
    }

    // 5. Check critically stale context
    if (activePolicy.disallowCriticallyStaleContext && contextFreshness === 'STALE') {
      missingConditions.push('Context cannot be critically stale upon completion');
      reasons.push('Context is critically stale. A refresh is required prior to completion.');
    }

    // 6. Check Verification Integration (Phase 7.7)
    if (this.verificationQueryService) {
      const vPolicy: VerificationPolicy = {
        ...(activePolicy.verificationPolicy ?? {}),
        requireTrustedVerification:
          activePolicy.requireTrustedVerification ??
          activePolicy.verificationPolicy?.requireTrustedVerification,
        disallowStale:
          activePolicy.disallowStaleVerification ??
          activePolicy.verificationPolicy?.disallowStale,
        disallowConflicts:
          activePolicy.disallowConflictingVerification ??
          activePolicy.verificationPolicy?.disallowConflicts,
      };

      completionEvidence = await this.verificationQueryService.getCompletionEvidence(
        task.taskId,
        vPolicy
      );

      if (!completionEvidence.canComplete) {
        for (const cond of completionEvidence.missingConditions) {
          if (!missingConditions.includes(cond)) {
            missingConditions.push(cond);
          }
        }
        for (const reason of completionEvidence.reasons) {
          if (!reasons.includes(reason)) {
            reasons.push(reason);
          }
        }
      }
    }

    let status: TaskCompletionStatus = 'READY_TO_COMPLETE';
    if (missingConditions.length > 0) {
      status = 'NOT_READY';
    }

    return {
      status,
      canComplete: missingConditions.length === 0,
      missingConditions,
      reasons,
      evaluatedAt,
      completionEvidence,
    };
  }
}

