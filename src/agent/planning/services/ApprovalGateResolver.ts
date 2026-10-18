import type {
  IApprovalGateResolver,
  ApprovalGate,
} from '../interfaces/IApprovalGateResolver.js';
import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { ApprovalRecord } from '../models/ApprovalStatus.js';
import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';

export class ApprovalGateResolver implements IApprovalGateResolver {
  private readonly gates = new Map<string, ApprovalGate>();

  public evaluateApprovalRequirement(node: TaskPlanNode): ApprovalRecord {
    const isCriticalRisk = node.risk === 'CRITICAL';
    const isDestructive =
      node.taskType === 'DATABASE' ||
      node.affectedFeatures.includes('destructive') ||
      node.affectedFeatures.includes('production');

    if (isCriticalRisk || isDestructive) {
      return {
        status: 'APPROVAL_REQUIRED',
        requiredByPolicy: isCriticalRisk ? 'CRITICAL_RISK_GATE' : 'DESTRUCTIVE_OPERATION_GATE',
      };
    }

    return {
      status: 'NOT_REQUIRED',
    };
  }

  public approveNode(node: TaskPlanNode, approver: string, comments?: string): TaskPlanNode {
    return {
      ...node,
      approval: {
        status: 'APPROVED',
        approvedBy: approver,
        approvedAt: Date.now(),
        requiredByPolicy: node.approval?.requiredByPolicy,
      },
      updatedAt: Date.now(),
    };
  }

  public rejectNode(node: TaskPlanNode, rejecter: string, reason: string): TaskPlanNode {
    return {
      ...node,
      status: 'BLOCKED',
      approval: {
        status: 'REJECTED',
        rejectedBy: rejecter,
        rejectedAt: Date.now(),
        rejectionReason: reason,
        requiredByPolicy: node.approval?.requiredByPolicy,
      },
      failureReason: `Approval rejected: ${reason}`,
      updatedAt: Date.now(),
    };
  }

  public async requiresApproval(
    node: TaskPlanNode,
    _plan?: CanonicalTaskPlan
  ): Promise<{ required: boolean; reason?: string }> {
    const req = this.evaluateApprovalRequirement(node);
    if (req.status === 'APPROVAL_REQUIRED') {
      const reason =
        node.risk === 'CRITICAL'
          ? 'Critical risk task requires human approval gate.'
          : 'Database modifications require administrative schema approval gate.';
      return { required: true, reason };
    }
    return { required: false };
  }

  public async createGate(
    taskId: string,
    requestedBy: string,
    reason: string
  ): Promise<ApprovalGate> {
    const gateId = `gate_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const gate: ApprovalGate = {
      gateId,
      taskId,
      status: 'APPROVAL_REQUIRED',
      requestedBy,
      reason,
      createdAt: Date.now(),
    };
    this.gates.set(gateId, gate);
    return gate;
  }

  public async resolveGate(
    gateId: string,
    resolution: { decision: 'APPROVE' | 'REJECT'; approverId: string; comments?: string }
  ): Promise<ApprovalGate> {
    const existing = this.gates.get(gateId);
    if (!existing) {
      throw new Error(`Approval gate '${gateId}' not found.`);
    }

    const now = Date.now();
    const updated: ApprovalGate = {
      ...existing,
      status: resolution.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      ...(resolution.decision === 'APPROVE'
        ? { approverId: resolution.approverId, approvedAt: now }
        : { rejectedBy: resolution.approverId, rejectedAt: now }),
      decisionComments: resolution.comments,
    };

    this.gates.set(gateId, updated);
    return updated;
  }
}
