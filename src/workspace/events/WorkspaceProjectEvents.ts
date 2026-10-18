import type { ResourceScope } from '../../security/models/ResourceScope.js';

export const WORKSPACE_PROJECT_EVENTS = {
  WORKSPACE_CREATED: 'workspace.created',
  WORKSPACE_UPDATED: 'workspace.updated',
  WORKSPACE_ARCHIVED: 'workspace.archived',
  WORKSPACE_RESTORED: 'workspace.restored',
  WORKSPACE_DELETED: 'workspace.deleted',

  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_INITIALIZED: 'project.initialized',
  PROJECT_ARCHIVED: 'project.archived',
  PROJECT_RESTORED: 'project.restored',
  PROJECT_DELETED: 'project.deleted',

  REPOSITORY_ATTACHED: 'project.repository.attached',
  REPOSITORY_DETACHED: 'project.repository.detached',

  MEMBERSHIP_CHANGED: 'workspace.membership.changed',
} as const;

export interface WorkspaceProjectEventPayload<T = unknown> {
  readonly eventId: string;
  readonly eventName: string;
  readonly scope: ResourceScope;
  readonly timestamp: string;
  readonly correlationId: string;
  readonly version: number;
  readonly principalId?: string | undefined;
  readonly data: T;
}
