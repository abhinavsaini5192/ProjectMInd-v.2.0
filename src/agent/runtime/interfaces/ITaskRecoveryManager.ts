import type { AgentTask } from '../../context/models/AgentTask.js';
import type { TaskRuntimeSnapshot } from '../models/TaskRuntimeSnapshot.js';

export interface TaskRecoveryResult {
  readonly task: AgentTask;
  readonly snapshot: TaskRuntimeSnapshot;
  readonly recovered: boolean;
  readonly contextStale: boolean;
  readonly warnings: readonly string[];
}

export interface SessionReconnectResult {
  readonly agentSessionId: string;
  readonly activeTasks: readonly AgentTask[];
  readonly snapshots: readonly TaskRuntimeSnapshot[];
}

export interface ITaskRecoveryManager {
  recoverTask(taskId: string, agentSessionId: string): Promise<TaskRecoveryResult>;
  reconnectSession(agentSessionId: string): Promise<SessionReconnectResult>;
}
