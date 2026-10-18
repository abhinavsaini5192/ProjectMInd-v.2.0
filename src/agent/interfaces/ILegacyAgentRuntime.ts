import type { IAgent } from './IAgent.js';
import type { AgentTask } from '../models/AgentTask.js';
import type { AgentResult } from '../models/AgentResult.js';

export interface ILegacyAgentRuntime {
  createAgent(repositoryId: string): IAgent;
  executeTask(task: AgentTask): Promise<AgentResult>;
  getAgent(agentId: string): IAgent | undefined;
}
