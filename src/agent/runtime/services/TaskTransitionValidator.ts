import { isValidTaskTransition, type AgentTaskStatus } from '../../context/models/AgentTask.js';
import { TaskLifecycleError } from '../errors/TaskRuntimeError.js';

export class TaskTransitionValidator {
  public static validate(
    currentState: AgentTaskStatus,
    targetState: AgentTaskStatus,
    reason?: string | undefined
  ): void {
    if (currentState === targetState) {
      return;
    }

    if (currentState === 'COMPLETED') {
      throw new TaskLifecycleError(
        `Cannot transition task from terminal state 'COMPLETED' to '${targetState}'. Tasks cannot be silently reopened.`,
        currentState,
        targetState
      );
    }

    if (currentState === 'CANCELLED') {
      throw new TaskLifecycleError(
        `Cannot transition task from terminal state 'CANCELLED' to '${targetState}'.`,
        currentState,
        targetState
      );
    }

    if (!isValidTaskTransition(currentState, targetState)) {
      throw new TaskLifecycleError(
        `Illegal task state transition from '${currentState}' to '${targetState}'.`,
        currentState,
        targetState
      );
    }

    if (targetState === 'BLOCKED' && (!reason || reason.trim() === '')) {
      throw new TaskLifecycleError(
        `Transitioning to 'BLOCKED' requires a valid reason.`,
        currentState,
        targetState
      );
    }

    if (targetState === 'FAILED' && (!reason || reason.trim() === '')) {
      throw new TaskLifecycleError(
        `Transitioning to 'FAILED' requires a valid reason.`,
        currentState,
        targetState
      );
    }

    if (targetState === 'CANCELLED' && (!reason || reason.trim() === '')) {
      throw new TaskLifecycleError(
        `Transitioning to 'CANCELLED' requires a valid reason.`,
        currentState,
        targetState
      );
    }
  }
}
