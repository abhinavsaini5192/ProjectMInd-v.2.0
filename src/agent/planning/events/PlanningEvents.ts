export const PlanningEventNames = {
  PLAN_CREATED: 'planning:plan_created',
  PLAN_VALIDATED: 'planning:plan_validated',
  PLAN_INVALIDATED: 'planning:plan_invalidated',
  PLAN_REVISED: 'planning:plan_revised',
  NODE_CREATED: 'planning:node_created',
  NODE_READY: 'planning:node_ready',
  NODE_BLOCKED: 'planning:node_blocked',
  NODE_ASSIGNED: 'planning:node_assigned',
  NODE_STARTED: 'planning:node_started',
  NODE_COMPLETED: 'planning:node_completed',
  NODE_FAILED: 'planning:node_failed',
  NODE_CANCELLED: 'planning:node_cancelled',
  NODE_VERIFICATION_REQUIRED: 'planning:node_verification_required',
  NODE_VERIFICATION_PASSED: 'planning:node_verification_passed',
  NODE_VERIFICATION_FAILED: 'planning:node_verification_failed',
  DEPENDENCY_SATISFIED: 'planning:dependency_satisfied',
  DEPENDENCY_BLOCKED: 'planning:dependency_blocked',
  CHECKPOINT_CREATED: 'planning:checkpoint_created',
  PLAN_PAUSED: 'planning:plan_paused',
  PLAN_RESUMED: 'planning:plan_resumed',
  PLAN_COMPLETED: 'planning:plan_completed',
  PLAN_FAILED: 'planning:plan_failed',
  PLAN_SUPERSEDED: 'planning:plan_superseded',
} as const;

export type PlanningEventName = (typeof PlanningEventNames)[keyof typeof PlanningEventNames];

export interface PlanningEventPayload {
  readonly planId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly nodeId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly agentId?: string | undefined;
  readonly timestamp: number;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}
