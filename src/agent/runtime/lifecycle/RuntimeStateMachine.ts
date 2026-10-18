import type { AgentRuntimeState } from '../models/AgentRuntimeState.js';
import { RuntimeStateError } from '../errors/AgentRuntimeError.js';
import { AgentRuntimeEvents, type AgentRuntimeLifecycleEventPayload } from '../events/AgentRuntimeEvents.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';

export const VALID_RUNTIME_TRANSITIONS: Readonly<Record<AgentRuntimeState, readonly AgentRuntimeState[]>> = {
  CREATED: ['INITIALIZING', 'STOPPED', 'FAILED'],
  INITIALIZING: ['READY', 'FAILED', 'STOPPED'],
  READY: ['RUNNING', 'PAUSED', 'DEGRADED', 'STOPPING', 'FAILED'],
  RUNNING: ['READY', 'PAUSED', 'DEGRADED', 'STOPPING', 'FAILED'],
  PAUSED: ['READY', 'RUNNING', 'STOPPING', 'FAILED'],
  DEGRADED: ['READY', 'RUNNING', 'RECOVERING', 'STOPPING', 'FAILED'],
  RECOVERING: ['READY', 'DEGRADED', 'FAILED', 'STOPPED'],
  STOPPING: ['STOPPED', 'FAILED'],
  STOPPED: ['INITIALIZING'],
  FAILED: ['RECOVERING', 'STOPPED'],
};

export class RuntimeStateMachine {
  private _state: AgentRuntimeState = 'CREATED';

  constructor(private readonly eventBus?: IEventBus | undefined) {}

  public getState(): AgentRuntimeState {
    return this._state;
  }

  public canTransition(toState: AgentRuntimeState): boolean {
    const allowed = VALID_RUNTIME_TRANSITIONS[this._state];
    return allowed ? allowed.includes(toState) : false;
  }

  public transition(
    toState: AgentRuntimeState,
    reason?: string | undefined,
    metadata?: Record<string, unknown> | undefined
  ): AgentRuntimeState {
    if (!this.canTransition(toState)) {
      throw new RuntimeStateError(
        `Invalid runtime state transition from '${this._state}' to '${toState}'. Allowed transitions: ${VALID_RUNTIME_TRANSITIONS[this._state]?.join(', ') ?? 'none'}`,
        this._state,
        toState,
        { reason, metadata }
      );
    }

    const previousState = this._state;
    this._state = toState;

    if (this.eventBus) {
      const payload: AgentRuntimeLifecycleEventPayload = {
        previousState,
        currentState: toState,
        timestamp: new Date().toISOString(),
        reason,
        metadata,
      };

      const eventName = this.resolveEventName(toState);
      if (eventName) {
        this.eventBus.publish(eventName, payload);
      }
    }

    return this._state;
  }

  private resolveEventName(state: AgentRuntimeState): string | undefined {
    switch (state) {
      case 'READY':
        return AgentRuntimeEvents.RUNTIME_READY;
      case 'RUNNING':
        return AgentRuntimeEvents.RUNTIME_STARTED;
      case 'PAUSED':
        return AgentRuntimeEvents.RUNTIME_PAUSED;
      case 'STOPPING':
        return AgentRuntimeEvents.RUNTIME_STOPPING;
      case 'STOPPED':
        return AgentRuntimeEvents.RUNTIME_STOPPED;
      case 'FAILED':
        return AgentRuntimeEvents.RUNTIME_FAILED;
      case 'RECOVERING':
        return AgentRuntimeEvents.RUNTIME_RECOVERING;
      case 'DEGRADED':
        return AgentRuntimeEvents.RUNTIME_DEGRADED;
      default:
        return undefined;
    }
  }
}
