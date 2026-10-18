import type { ITaskPrioritizer } from '../interfaces/ITaskPrioritizer.js';
import type { ITaskDependencyResolver } from '../interfaces/ITaskDependencyResolver.js';
import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { TaskPriorityExplanation } from '../models/TaskPriorityExplanation.js';

export class TaskPrioritizer implements ITaskPrioritizer {
  constructor(private readonly _dependencyResolver?: ITaskDependencyResolver | undefined) {}

  public prioritize(
    nodesOrPlan: readonly TaskPlanNode[] | CanonicalTaskPlan,
    maybePlan?: CanonicalTaskPlan
  ): TaskPlanNode[] {
    let nodes: readonly TaskPlanNode[];
    let plan: CanonicalTaskPlan;

    if (Array.isArray(nodesOrPlan)) {
      nodes = nodesOrPlan;
      plan = maybePlan!;
    } else {
      plan = nodesOrPlan as CanonicalTaskPlan;
      nodes = plan.nodes;
    }

    const scored = nodes.map((node) => ({
      node,
      explanation: this.explainPriority(node, plan),
    }));

    scored.sort((a, b) => b.explanation.finalScore - a.explanation.finalScore);

    return scored.map((s) => s.node);
  }

  public explainPriority(
    nodeOrPlan: TaskPlanNode | CanonicalTaskPlan,
    planOrNodeId: CanonicalTaskPlan | string
  ): TaskPriorityExplanation {
    let node: TaskPlanNode;
    let plan: CanonicalTaskPlan;

    if (typeof planOrNodeId === 'string') {
      plan = nodeOrPlan as CanonicalTaskPlan;
      node = plan.nodes.find((n) => n.id === planOrNodeId)!;
      if (!node) {
        throw new Error(`Node '${planOrNodeId}' not found in plan '${plan.id}'.`);
      }
    } else {
      node = nodeOrPlan as TaskPlanNode;
      plan = planOrNodeId as CanonicalTaskPlan;
    }

    // 1. Blocking Impact: How many downstream tasks depend on this node
    const downstreamCount = plan.nodes.filter((n) =>
      n.dependencies.some((d) => d.targetNodeId === node.id)
    ).length;
    const blockingImpact = downstreamCount * 15;

    // 2. Dependency Impact: Nodes with fewer unmet dependencies can start sooner
    const dependencyImpact = Math.max(0, 10 - node.dependencies.length * 2);

    // 3. User / Node Priority: Native priority field (1-10, scaled x5)
    const userPriority = Math.min(10, Math.max(1, node.priority ?? 5)) * 5;

    // 4. Security / Risk Impact
    let securityImpact = 0;
    if (
      node.taskType === 'SECURITY_REVIEW' ||
      node.affectedFeatures.includes('auth') ||
      node.affectedFeatures.includes('security')
    ) {
      securityImpact = 20;
    }

    let riskImpact = 0;
    if (node.risk === 'HIGH' || node.risk === 'CRITICAL') {
      riskImpact = 10;
    }

    // 5. Readiness Boost
    const isReady =
      node.status === 'READY' ||
      (node.status === 'PENDING' &&
        node.dependencies.every((d) => {
          const target = plan.nodes.find((n) => n.id === d.targetNodeId);
          return target && target.status === 'COMPLETED';
        }));

    const readinessBoost = isReady ? 30 : 0;
    const finalScore = userPriority + blockingImpact + dependencyImpact + securityImpact + riskImpact + readinessBoost;

    const rationaleParts: string[] = [];
    if (blockingImpact > 0) rationaleParts.push(`blocks ${downstreamCount} downstream task(s)`);
    if (securityImpact > 0) rationaleParts.push('contains security/auth impact');
    if (isReady) rationaleParts.push('prerequisites met (ready to run)');
    if (userPriority >= 40) rationaleParts.push('high base priority');
    const rationale = rationaleParts.length > 0 ? rationaleParts.join(', ') : 'standard sequential execution';

    return {
      nodeId: node.id,
      dependencyImpact,
      blockingImpact,
      riskImpact,
      securityImpact,
      userPriority,
      readiness: isReady ? 'READY' : 'BLOCKED_OR_PENDING',
      finalScore,
      rationale,
      factors: {
        dependencyImpact,
        blockingImpact,
        riskImpact,
        securityImpact,
        userPriority,
        readinessBoost,
      },
    };
  }
}
