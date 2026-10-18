import type { AgentRuntimeState } from '../models/AgentRuntimeState.js';
import type { IAgentLifecycleCoordinator } from '../interfaces/IAgentLifecycleCoordinator.js';
import { RuntimeStateMachine } from './RuntimeStateMachine.js';
import { RuntimeTransitionValidator } from './RuntimeTransitionValidator.js';
import type { IEventBus } from '../../../workspace/interfaces/IEventBus.js';

export class RuntimeLifecycleManager implements IAgentLifecycleCoordinator {
  private readonly stateMachine: RuntimeStateMachine;
  private readonly validator: RuntimeTransitionValidator;

  constructor(eventBus?: IEventBus | undefined) {
    this.stateMachine = new RuntimeStateMachine(eventBus);
    this.validator = new RuntimeTransitionValidator();
  }

  public getState(): AgentRuntimeState {
    return this.stateMachine.getState();
  }

  public canTransition(toState: AgentRuntimeState): boolean {
    return this.stateMachine.canTransition(toState);
  }

  public async initialize(): Promise<void> {
    const current = this.stateMachine.getState();
    const validation = this.validator.validateTransition(current, 'INITIALIZING');
    if (!validation.valid) {
      throw new Error(validation.reason);
    }
    this.stateMachine.transition('INITIALIZING', 'Runtime initialization started');
    // Initialization steps
    this.stateMachine.transition('READY', 'Runtime initialized and ready');
  }

  public async start(): Promise<void> {
    const current = this.stateMachine.getState();
    const validation = this.validator.validateTransition(current, 'RUNNING');
    if (!validation.valid) {
      throw new Error(validation.reason);
    }
    this.stateMachine.transition('RUNNING', 'Runtime started');
  }

  public async pause(reason?: string): Promise<void> {
    const current = this.stateMachine.getState();
    const validation = this.validator.validateTransition(current, 'PAUSED');
    if (!validation.valid) {
      throw new Error(validation.reason);
    }
    this.stateMachine.transition('PAUSED', reason ?? 'Runtime paused');
  }

  public async resume(): Promise<void> {
    const current = this.stateMachine.getState();
    const validation = this.validator.validateTransition(current, 'RUNNING');
    if (!validation.valid) {
      // If we cannot go directly to RUNNING, try READY
      if (this.stateMachine.canTransition('READY')) {
        this.stateMachine.transition('READY', 'Runtime resumed to ready');
        return;
      }
      throw new Error(validation.reason);
    }
    this.stateMachine.transition('RUNNING', 'Runtime resumed');
  }

  public async stop(reason?: string): Promise<void> {
    const current = this.stateMachine.getState();
    if (current === 'STOPPED') {
      return;
    }
    if (this.stateMachine.canTransition('STOPPING')) {
      this.stateMachine.transition('STOPPING', reason ?? 'Runtime stopping');
    }
    this.stateMachine.transition('STOPPED', reason ?? 'Runtime stopped');
  }

  public async fail(error: Error): Promise<void> {
    this.stateMachine.transition('FAILED', error.message, { errorName: error.name, stack: error.stack });
  }

  public async setDegraded(reason: string): Promise<void> {
    if (this.stateMachine.canTransition('DEGRADED')) {
      this.stateMachine.transition('DEGRADED', reason);
    }
  }

  public async recover(): Promise<void> {
    const current = this.stateMachine.getState();
    if (this.stateMachine.canTransition('RECOVERING')) {
      this.stateMachine.transition('RECOVERING', 'Initiating recovery');
      this.stateMachine.transition('READY', 'Recovery completed');
    } else if (current === 'DEGRADED' || current === 'FAILED') {
      this.stateMachine.transition('RECOVERING', 'Recovery initiated');
      this.stateMachine.transition('READY', 'Recovery completed');
    }
  }
}
