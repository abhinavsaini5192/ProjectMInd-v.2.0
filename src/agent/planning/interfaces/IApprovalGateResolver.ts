import type { TaskPlanNode } from '../models/TaskPlanNode.js';
import type { ApprovalRecord, ApprovalStatus } from '../models/ApprovalStatus.js';
import type { CanonicalTaskPlan } from '../models/CanonicalTaskPlan.js';

export interface ApprovalGate {
  readonly gateId: string;
  readonly taskId: string;
  readonly status: ApprovalStatus;
  readonly requestedBy: string;
  readonly reason: string;
  readonly approverId?: string | undefined;
  readonly approvedAt?: number | undefined;
  readonly rejectedBy?: string | undefined;
  readonly rejectedAt?: number | undefined;
  readonly decisionComments?: string | undefined;
  readonly createdAt: number;
}

export interface IApprovalGateResolver {
  evaluateApprovalRequirement(node: TaskPlanNode): ApprovalRecord;
  approveNode(node: TaskPlanNode, approver: string, comments?: string): TaskPlanNode;
  rejectNode(node: TaskPlanNode, rejecter: string, reason: string): TaskPlanNode;
  requiresApproval(node: TaskPlanNode, plan?: CanonicalTaskPlan): Promise<{ required: boolean; reason?: string }>;
  createGate(taskId: string, requestedBy: string, reason: string): Promise<ApprovalGate>;
  resolveGate(
    gateId: string,
    resolution: { decision: 'APPROVE' | 'REJECT'; approverId: string; comments?: string }
  ): Promise<ApprovalGate>;
}
