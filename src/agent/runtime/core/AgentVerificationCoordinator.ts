import type {
  ITaskVerificationCoordinator,
  TaskVerificationReportParams,
  TaskVerificationReportResult,
} from '../interfaces/ITaskVerificationCoordinator.js';
import type { ScopeValidationParams } from '../interfaces/ITaskExecutionCoordinator.js';
import type { IAgentVerificationCoordinator, TaskVerificationCheckResult } from '../interfaces/IAgentVerificationCoordinator.js';
import type { IVerificationProcessor } from '../../../verification/interfaces/IVerificationProcessor.js';

export class AgentVerificationCoordinator implements IAgentVerificationCoordinator {
  constructor(
    private readonly verificationCoordinator: ITaskVerificationCoordinator,
    private readonly verificationProcessor?: IVerificationProcessor | undefined
  ) {}

  public async verifyTask(
    taskId: string,
    scope: ScopeValidationParams
  ): Promise<TaskVerificationCheckResult> {
    const vState = await this.verificationCoordinator.getVerificationState(taskId);
    const passed = vState.verificationState === 'PASSED';
    const missingConditions: string[] = [];
    const reasons: string[] = [];

    if (!passed) {
      if (vState.verificationState === 'FAILED') {
        reasons.push('Verification reports show test or build failure');
      } else if (vState.verificationState === 'NOT_STARTED' || vState.verificationState === 'RUNNING') {
        missingConditions.push('VERIFICATION_REQUIRED');
        reasons.push('Task verification is still pending');
      }
    }

    return {
      canComplete: passed,
      passed,
      missingConditions,
      reasons,
      details: {
        verificationStatus: vState.verificationState,
        lastReportId: vState.lastReportId,
      },
    };
  }

  public async recordVerificationReport(
    params: TaskVerificationReportParams,
    scope: ScopeValidationParams
  ): Promise<TaskVerificationReportResult> {
    return this.verificationCoordinator.reportVerification(params, scope);
  }
}
