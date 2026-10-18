export type ConstraintType =
  | 'TIME_BUDGET'
  | 'TOKEN_BUDGET'
  | 'RESOURCE_LOCK'
  | 'SECURITY_CLEARANCE'
  | 'HUMAN_APPROVAL_REQUIRED'
  | 'ATOMIC_EXECUTION'
  | 'ISOLATED_ENVIRONMENT'
  | 'CUSTOM';

export interface TaskConstraint {
  readonly id: string;
  readonly type: ConstraintType;
  readonly description: string;
  readonly hard: boolean; // hard constraints fail planning if violated; soft emit warnings
  readonly parameter?: unknown | undefined;
}
