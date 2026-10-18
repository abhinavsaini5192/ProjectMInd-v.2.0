export const TaskPlanStatus = {
  DRAFT: 'DRAFT',
  PLANNING: 'PLANNING',
  VALIDATING: 'VALIDATING',
  READY: 'READY',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  BLOCKED: 'BLOCKED',
  PARTIALLY_COMPLETED: 'PARTIALLY_COMPLETED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  SUPERSEDED: 'SUPERSEDED',
} as const;

export type TaskPlanStatus = (typeof TaskPlanStatus)[keyof typeof TaskPlanStatus];

export const TaskPlanStatuses = Object.values(TaskPlanStatus);

export const LEGAL_PLAN_TRANSITIONS: Record<TaskPlanStatus, readonly TaskPlanStatus[]> = {
  DRAFT: ['PLANNING', 'READY', 'RUNNING', 'CANCELLED'],
  PLANNING: ['VALIDATING', 'FAILED', 'CANCELLED'],
  VALIDATING: ['READY', 'PLANNING', 'FAILED', 'CANCELLED'],
  READY: ['RUNNING', 'PAUSED', 'CANCELLED', 'PLANNING'],
  RUNNING: ['PAUSED', 'BLOCKED', 'PARTIALLY_COMPLETED', 'COMPLETED', 'FAILED', 'CANCELLED'],
  PAUSED: ['RUNNING', 'CANCELLED', 'SUPERSEDED'],
  BLOCKED: ['RUNNING', 'PLANNING', 'PAUSED', 'FAILED', 'CANCELLED'],
  PARTIALLY_COMPLETED: ['RUNNING', 'COMPLETED', 'FAILED', 'PAUSED', 'SUPERSEDED'],
  COMPLETED: ['SUPERSEDED'],
  FAILED: ['PLANNING', 'SUPERSEDED'],
  CANCELLED: ['SUPERSEDED'],
  SUPERSEDED: [],
};

export function isLegalPlanTransition(
  from: TaskPlanStatus,
  to: TaskPlanStatus
): boolean {
  const allowed = LEGAL_PLAN_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}
