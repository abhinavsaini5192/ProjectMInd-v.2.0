import type { AgentRuntimeState } from '../models/AgentRuntimeState.js';
import { VALID_RUNTIME_TRANSITIONS } from './RuntimeStateMachine.js';

export interface TransitionValidationResult {
  readonly valid: boolean;
  readonly reason?: string | undefined;
}

export class RuntimeTransitionValidator {
  public validateTransition(
    fromState: AgentRuntimeState,
    toState: AgentRuntimeState,
    context?: { activeSessions?: number; activeTasks?: number; isHealthy?: boolean }
  ): TransitionValidationResult {
    const allowed = VALID_RUNTIME_TRANSITIONS[fromState];
    if (!allowed || !allowed.includes(toState)) {
      return {
        valid: false,
        reason: `Transition from '${fromState}' to '${toState}' is not permitted by state machine matrix`,
      };
    }

    if (toState === 'RUNNING' && context?.isHealthy === false) {
      return {
        valid: false,
        reason: `Cannot transition to RUNNING when runtime health is degraded or unhealthy`,
      };
    }

    return { valid: true };
  }
}
