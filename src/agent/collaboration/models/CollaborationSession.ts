import type { CollaborationSessionStatus } from './CollaborationSessionStatus.js';
import type { CollaborationParticipant } from './CollaborationParticipant.js';

export interface CollaborationSession {
  readonly collaborationSessionId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly repositoryIds: readonly string[];
  readonly taskId?: string | undefined;
  readonly title: string;
  readonly description?: string | undefined;
  readonly coordinatorAgentId: string;
  readonly participants: readonly CollaborationParticipant[];
  readonly status: CollaborationSessionStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly version: number;
  readonly metadata?: Record<string, unknown> | undefined;
}
