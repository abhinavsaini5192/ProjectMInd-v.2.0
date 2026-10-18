import { VerificationResult, OverallStatus } from '../../verification/models/VerificationResult';
import { FailureClassifier } from '../classification/FailureClassifier';
import { PreExistingFailureDetector } from './PreExistingFailureDetector';
import { RecoveryDecisionEngine } from './RecoveryDecisionEngine';
import { RecoveryState } from '../models/RecoveryState';
import { RecoveryStrategyType } from '../models/RecoveryPlan';
import { RecoveryResult, RecoveryStatus } from '../models/RecoveryResult';
import { RecoveryAttempt } from '../models/RecoveryAttempt';
import { KernelEventDispatcher } from '../../../kernel/core/KernelEventDispatcher';

export class RecoveryEngine {
  private MAX_ATTEMPTS = 3;
  private classifier = new FailureClassifier();
  private detector = new PreExistingFailureDetector();
  private decisionEngine = new RecoveryDecisionEngine();
  private attempts: RecoveryAttempt[] = [];

  constructor(private dispatcher: KernelEventDispatcher) {}

  public async orchestrateRecovery(beforeVerification: VerificationResult, afterVerification: VerificationResult): Promise<RecoveryResult> {
    const recoveryId = `rec_${Date.now()}`;
    this.dispatcher.publish('RECOVERY_STARTED', { recoveryId });
    
    // 1. Detect if it's new
    const preExisting = this.detector.detect(beforeVerification, afterVerification);
    
    // 2. Classify
    const { category, severity } = this.classifier.classify(afterVerification);
    this.dispatcher.publish('FAILURE_CLASSIFIED', { category, severity });

    let currentState: RecoveryState = RecoveryState.ANALYZING;
    let attemptNumber = 0;
    const isTerminal = (state: RecoveryState): boolean =>
      state === RecoveryState.SUCCESS ||
      state === RecoveryState.ROLLED_BACK ||
      state === RecoveryState.ESCALATED ||
      state === RecoveryState.ABORTED;

    while (!isTerminal(currentState)) {
      
      const plan = this.decisionEngine.selectStrategy(category, severity, attemptNumber, this.MAX_ATTEMPTS, !preExisting.isNew);
      this.dispatcher.publish('RECOVERY_STRATEGY_SELECTED', { strategy: plan.strategy });

      attemptNumber++;
      const attempt: RecoveryAttempt = {
         attemptId: `att_${Date.now()}`,
         timestamp: Date.now(),
         strategy: plan.strategy,
         failureMessage: plan.reason,
         evidence: preExisting.newFailures,
         result: 'SUCCESS'
      };

      this.dispatcher.publish('RECOVERY_ATTEMPT_STARTED', { attemptId: attempt.attemptId });

      try {
        if (plan.strategy === RecoveryStrategyType.NO_ACTION) {
           attempt.result = 'SUCCESS';
           currentState = RecoveryState.ABORTED; // Pre-existing, we just abort recovery successfully
        } else if (plan.strategy === RecoveryStrategyType.ROLLBACK) {
           currentState = RecoveryState.ROLLING_BACK;
           this.dispatcher.publish('ROLLBACK_STARTED', { recoveryId });
           // Perform rollback...
           currentState = RecoveryState.ROLLED_BACK;
           this.dispatcher.publish('ROLLBACK_COMPLETED', { recoveryId });
        } else if (plan.strategy === RecoveryStrategyType.ESCALATE) {
           currentState = RecoveryState.ESCALATED;
           this.dispatcher.publish('RECOVERY_ESCALATED', { recoveryId });
        } else if (plan.strategy === RecoveryStrategyType.REPAIR) {
           currentState = RecoveryState.RECOVERING;
           // If repair actually happens in a real environment it would recurse through 4.4->4.7
           // For this loop simulation, we will assume it fails again to test the limits
           attempt.result = 'FAILED';
           currentState = RecoveryState.FAILED;
        }

        this.attempts.push(attempt);
        this.dispatcher.publish('RECOVERY_ATTEMPT_COMPLETED', { attemptId: attempt.attemptId });

      } catch (e) {
         attempt.result = 'FAILED';
         this.attempts.push(attempt);
         currentState = RecoveryState.FAILED;
      }
    }

    let finalStatus = RecoveryStatus.UNRESOLVED;
    if (currentState === RecoveryState.ROLLED_BACK) finalStatus = RecoveryStatus.ROLLED_BACK;
    if (currentState === RecoveryState.ESCALATED) finalStatus = RecoveryStatus.ESCALATED;
    if (currentState === RecoveryState.ABORTED) finalStatus = RecoveryStatus.ABORTED; // Meaning NO_ACTION taken safely

    if (finalStatus === RecoveryStatus.ROLLED_BACK || finalStatus === RecoveryStatus.ABORTED) {
       this.dispatcher.publish('RECOVERY_SUCCEEDED', { recoveryId });
    } else {
       this.dispatcher.publish('RECOVERY_FAILED', { recoveryId });
    }

    return {
       recoveryId,
       status: finalStatus,
       attempts: this.attempts,
       finalState: currentState,
       originalFailure: category,
       explanation: `Recovery ended in state: ${currentState}`
    };
  }
}
