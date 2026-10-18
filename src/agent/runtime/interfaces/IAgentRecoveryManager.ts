import type { AgentRuntimeRecoveryState } from '../models/AgentRuntimeRecoveryState.js';

export interface IAgentRecoveryManager {
  recover(checkpointId?: string): Promise<AgentRuntimeRecoveryState>;
  reconcileState(): Promise<AgentRuntimeRecoveryState>;
  getRecoveryState(): AgentRuntimeRecoveryState | undefined;
}
