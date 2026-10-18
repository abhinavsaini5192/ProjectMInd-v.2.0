import { ActionPlan } from '../../planning/models/ActionPlan.js';
import { OrchestrationPolicy } from '../policies/OrchestrationPolicy.js';

export class ApprovalGuard {
  public requiresApproval(plan: ActionPlan, policy: OrchestrationPolicy): boolean {
    if (!policy.requireApprovalForHighRisk) return false;

    // Any plan containing DELETE / high-risk operations requires explicit approval
    const hasHighRisk = plan.steps.some(s =>
      s.type === 'DELETE' ||
      s.riskLevel === 'CRITICAL' ||
      s.riskLevel === 'HIGH'
    ) || (plan.risks && plan.risks.some(r => r.level === 'HIGH' || r.level === 'CRITICAL'));

    const isExplicitlyFlagged = plan.status === 'NEEDS_APPROVAL';

    return hasHighRisk || isExplicitlyFlagged;
  }
}
