import type { AgentRuntimeCheckpoint } from '../models/AgentRuntimeCheckpoint.js';
import type { AgentRuntimeRecoveryState } from '../models/AgentRuntimeRecoveryState.js';

export interface IAgentCheckpointManager {
  createCheckpoint(label?: string): Promise<AgentRuntimeCheckpoint>;
  getCheckpoint(checkpointId: string): Promise<AgentRuntimeCheckpoint | undefined>;
  listCheckpoints(): Promise<readonly AgentRuntimeCheckpoint[]>;
  restoreCheckpoint(checkpointId: string): Promise<AgentRuntimeRecoveryState>;
  pruneCheckpoints(keepCount: number): Promise<number>;
}
