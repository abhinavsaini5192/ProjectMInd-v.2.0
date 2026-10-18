export class PlanningError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'PLANNING_ERROR',
    public readonly details?: Record<string, unknown> | undefined
  ) {
    super(message);
    this.name = 'PlanningError';
  }
}

export class PlanNotFoundError extends PlanningError {
  constructor(planId: string) {
    super(`Task plan '${planId}' was not found.`, 'PLAN_NOT_FOUND', { planId });
    this.name = 'PlanNotFoundError';
  }
}

export class TaskNodeNotFoundError extends PlanningError {
  constructor(planId: string, nodeId: string) {
    super(`Task plan node '${nodeId}' was not found in plan '${planId}'.`, 'TASK_NODE_NOT_FOUND', {
      planId,
      nodeId,
    });
    this.name = 'TaskNodeNotFoundError';
  }
}

export class PlanValidationError extends PlanningError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PLAN_VALIDATION_ERROR', details);
    this.name = 'PlanValidationError';
  }
}

export class PlanDependencyCycleError extends PlanningError {
  constructor(cycle: readonly string[]) {
    super(`Dependency cycle detected in plan: ${cycle.join(' -> ')}`, 'DEPENDENCY_CYCLE_DETECTED', {
      cycle,
    });
    this.name = 'PlanDependencyCycleError';
  }
}

export class PlanSecurityError extends PlanningError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PLAN_SECURITY_ERROR', details);
    this.name = 'PlanSecurityError';
  }
}

export class PlanConflictError extends PlanningError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'PLAN_CONFLICT_ERROR', details);
    this.name = 'PlanConflictError';
  }
}

export class PlanStateTransitionError extends PlanningError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Illegal plan state transition from '${fromStatus}' to '${toStatus}'.`,
      'ILLEGAL_STATE_TRANSITION',
      { fromStatus, toStatus }
    );
    this.name = 'PlanStateTransitionError';
  }
}
