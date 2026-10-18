import { ILegacyAgentRuntime } from '../interfaces/ILegacyAgentRuntime.js';
import { IAgent } from '../interfaces/IAgent.js';
import { IBrainGateway } from '../interfaces/IBrainGateway.js';
import { AgentTask } from '../models/AgentTask.js';
import { AgentResult } from '../models/AgentResult.js';
import { Agent } from './Agent.js';
import { KernelEventDispatcher } from '../../kernel/core/KernelEventDispatcher.js';

export class AgentRuntime implements ILegacyAgentRuntime {
  private agents: Map<string, IAgent> = new Map();

  constructor(
    private dispatcher: KernelEventDispatcher,
    private brainGateway: IBrainGateway
  ) {}

  public createAgent(repositoryId: string): IAgent {
    const agentId = `agent_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const sessionId = `sess_${agentId}`;
    
    const agent = new Agent(agentId, sessionId, repositoryId, this.dispatcher, this.brainGateway);
    this.agents.set(agentId, agent);
    
    return agent;
  }

  public getAgent(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  public async executeTask(task: AgentTask): Promise<AgentResult> {
    const agent = this.createAgent(task.repositoryId);
    await agent.submitTask(task);
    return agent.start();
  }
}
