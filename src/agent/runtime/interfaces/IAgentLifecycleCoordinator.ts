import type { AgentRuntimeState } from '../models/AgentRuntimeState.js';

export interface IAgentLifecycleCoordinator {
  getState(): AgentRuntimeState;
  canTransition(toState: AgentRuntimeState): boolean;
  initialize(): Promise<void>;
  start(): Promise<void>;
  pause(reason?: string): Promise<void>;
  resume(): Promise<void>;
  stop(reason?: string): Promise<void>;
  fail(error: Error): Promise<void>;
  setDegraded(reason: string): Promise<void>;
  recover(): Promise<void>;
}
