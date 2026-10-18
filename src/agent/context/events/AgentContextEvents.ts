export enum AgentContextEventType {
  SESSION_CREATED = 'agent.context.session.created',
  SESSION_UPDATED = 'agent.context.session.updated',
  SESSION_STALE = 'agent.context.session.stale',
  CONTEXT_REFRESHED = 'agent.context.refreshed',
  CONTEXT_INVALIDATED = 'agent.context.invalidated',
  CONTEXT_PINNED = 'agent.context.pinned',
  CONTEXT_UNPINNED = 'agent.context.unpinned',
  TASK_CREATED = 'agent.task.created',
  TASK_UPDATED = 'agent.task.updated',
  TASK_COMPLETED = 'agent.task.completed',
  TASK_FAILED = 'agent.task.failed',
  FEEDBACK_RECEIVED = 'agent.context.feedback.received',
}

export interface AgentContextEventPayload<T = Record<string, unknown>> {
  readonly eventType: AgentContextEventType;
  readonly contextSessionId?: string | undefined;
  readonly taskId?: string | undefined;
  readonly agentSessionId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly repositoryId?: string | undefined;
  readonly timestamp: number;
  readonly data: T;
}
