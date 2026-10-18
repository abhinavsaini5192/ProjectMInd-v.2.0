import type { AgentTask } from '../models/AgentTask.js';
import type { AgentResult } from '../models/AgentResult.js';
import type { AgentState } from '../core/AgentLifecycle.js';

export interface IAgent {
  readonly agentId: string;
  readonly sessionId: string;

  getState(): AgentState;
  submitTask(task: AgentTask): Promise<void>;
  start(): Promise<AgentResult>;
  cancel(reason?: string): void;
}
