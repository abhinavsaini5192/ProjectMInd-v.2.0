export const CollaborationEventNames = {
  COLLABORATION_CREATED: 'collaboration.created',
  PARTICIPANT_JOINED: 'collaboration.participant.joined',
  PARTICIPANT_LEFT: 'collaboration.participant.left',
  TASK_ASSIGNED: 'collaboration.task.assigned',
  TASK_UNASSIGNED: 'collaboration.task.unassigned',
  RESOURCE_RESERVED: 'collaboration.resource.reserved',
  RESOURCE_RELEASED: 'collaboration.resource.released',
  CONFLICT_DETECTED: 'collaboration.conflict.detected',
  CONFLICT_RESOLVED: 'collaboration.conflict.resolved',
  HANDOFF_CREATED: 'collaboration.handoff.created',
  HANDOFF_ACCEPTED: 'collaboration.handoff.accepted',
  DECISION_RECORDED: 'collaboration.decision.recorded',
  COLLABORATION_PAUSED: 'collaboration.paused',
  COLLABORATION_COMPLETED: 'collaboration.completed',
  COLLABORATION_FAILED: 'collaboration.failed',
} as const;

export type CollaborationEventName =
  typeof CollaborationEventNames[keyof typeof CollaborationEventNames];

export interface CollaborationEvent<T = any> {
  readonly eventId: string;
  readonly name: CollaborationEventName;
  readonly collaborationSessionId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly timestamp: number;
  readonly payload: T;
}
