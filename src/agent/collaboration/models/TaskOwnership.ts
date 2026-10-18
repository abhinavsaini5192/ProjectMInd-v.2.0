export type TaskOwnershipStatus =
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'HANDED_OFF'
  | 'FAILED';

export interface TaskOwnership {
  readonly taskId: string;
  readonly ownerAgentId: string;
  readonly collaboratorAgentIds: readonly string[];
  readonly reviewerAgentId?: string | undefined;
  readonly verifierAgentId?: string | undefined;
  readonly assignedAt: number;
  readonly updatedAt: number;
  readonly status: TaskOwnershipStatus;
  readonly notes?: string | undefined;
}
