import type {
  ITaskAssignmentResolver,
  AssignmentResolutionResult,
} from '../interfaces/ITaskAssignmentResolver.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { IAgentRegistry } from '../../interfaces/IAgentRegistry.js';
import { AgentCapabilitySet } from '../../models/AgentCapabilitySet.js';

export class TaskAssignmentResolver implements ITaskAssignmentResolver {
  constructor(private readonly agentRegistry?: IAgentRegistry | undefined) {}

  public async resolveAssignment(
    node: TaskPlanNode,
    plan: CanonicalTaskPlan
  ): Promise<AssignmentResolutionResult> {
    if (!this.agentRegistry) {
      // In standalone mode without external registry, assign to system default worker
      return {
        assigned: true,
        assignment: {
          agentId: 'default_agent',
          assignedAt: Date.now(),
          role: node.preferredAgentRole ?? 'IMPLEMENTER',
          requiredCapabilities: node.requiredCapabilities,
          assignedBy: 'SYSTEM_PLANNER',
          reason: 'Autonomous fallback assignment to default worker.',
        },
        candidatesEvaluated: 1,
      };
    }

    const agents = await this.agentRegistry.list();
    const activeAgents = agents.filter((a) => a.status === 'ACTIVE');

    if (activeAgents.length === 0) {
      return {
        assigned: false,
        candidatesEvaluated: agents.length,
        reason: 'No active agents available in registry.',
      };
    }

    // Filter agents matching required capabilities
    const eligible = activeAgents.filter((agent) => {
      const caps = agent.capabilities instanceof AgentCapabilitySet
        ? new Set(agent.capabilities.toArray())
        : new Set(Array.isArray(agent.capabilities) ? agent.capabilities : []);
      return node.requiredCapabilities.every((reqCap) => caps.has(reqCap as any));
    });

    if (eligible.length === 0) {
      // Relax capability constraint if strict match not found, but log warning
      const fallback = activeAgents[0]!;
      return {
        assigned: true,
        assignment: {
          agentId: fallback.agentId,
          assignedAt: Date.now(),
          role: node.preferredAgentRole ?? 'IMPLEMENTER',
          requiredCapabilities: node.requiredCapabilities,
          assignedBy: 'SYSTEM_PLANNER',
          reason: `Partial match: Agent '${fallback.agentId}' assigned despite capability gap.`,
        },
        candidatesEvaluated: activeAgents.length,
      };
    }

    // Pick first matching eligible agent
    const selected = eligible[0]!;
    return {
      assigned: true,
      assignment: {
        agentId: selected.agentId,
        assignedAt: Date.now(),
        role: node.preferredAgentRole ?? 'IMPLEMENTER',
        requiredCapabilities: node.requiredCapabilities,
        assignedBy: 'SYSTEM_PLANNER',
        reason: `Optimal capability match for role '${node.preferredAgentRole ?? 'IMPLEMENTER'}'.`,
      },
      candidatesEvaluated: activeAgents.length,
    };
  }

  public async validateAssignment(
    node: TaskPlanNode,
    agentId: string,
    _plan: CanonicalTaskPlan
  ): Promise<boolean> {
    if (!this.agentRegistry) return true;

    const agent = await this.agentRegistry.get(agentId);
    if (!agent || agent.status !== 'ACTIVE') {
      return false;
    }

    // Verify required capabilities
    const agentCaps = agent.capabilities instanceof AgentCapabilitySet
      ? new Set(agent.capabilities.toArray())
      : new Set(Array.isArray(agent.capabilities) ? agent.capabilities : []);
    return node.requiredCapabilities.every((cap) => agentCaps.has(cap as any));
  }
}
