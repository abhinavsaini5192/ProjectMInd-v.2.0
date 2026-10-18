import type { AgentIdentity } from '../../models/AgentIdentity.js';
import type { CollaborationRole } from './CollaborationRole.js';
import type { ParticipantStatus } from './ParticipantStatus.js';

export interface CollaborationParticipant {
  readonly agentId: string;
  readonly agentIdentity?: AgentIdentity | undefined;
  readonly role: CollaborationRole;
  readonly status: ParticipantStatus;
  readonly capabilities: readonly string[];
  readonly joinedAt: number;
  readonly lastSeenAt: number;
  readonly scope?: {
    readonly workspaceId: string;
    readonly projectId: string;
    readonly repositoryIds?: readonly string[] | undefined;
  } | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
