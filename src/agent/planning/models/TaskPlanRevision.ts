export type RevisionTrigger =
  | 'TASK_FAILURE'
  | 'VERIFICATION_FAILURE'
  | 'DEPENDENCY_CYCLE'
  | 'RESOURCE_CONFLICT'
  | 'REPOSITORY_MUTATION'
  | 'MANUAL_REPLAN'
  | 'MANUAL_REQUEST'
  | 'STALE_CONTEXT';

export interface TaskPlanRevision {
  readonly revisionId: string;
  readonly planId: string;
  readonly previousRevision: number;
  readonly newRevision: number;
  readonly revisionNumber?: number | undefined;
  readonly trigger: RevisionTrigger;
  readonly reason: string;
  readonly affectedNodeIds: readonly string[];
  readonly addedNodeIds: readonly string[];
  readonly removedNodeIds: readonly string[];
  readonly createdAt: number;
  readonly createdBy: string;
}
