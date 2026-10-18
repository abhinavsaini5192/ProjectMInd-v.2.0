export type CollaborationMessageType =
  | 'INFORMATION'
  | 'REQUEST'
  | 'BLOCKER'
  | 'HANDOFF'
  | 'DECISION'
  | 'WARNING'
  | 'CONFLICT'
  | 'STATUS'
  | 'UNKNOWN';

export interface CollaborationMessage {
  readonly messageId: string;
  readonly collaborationSessionId: string;
  readonly senderAgentId: string;
  readonly recipientAgentIds: readonly string[]; // Empty means broadcast to all participants in session
  readonly taskId?: string | undefined;
  readonly projectId: string;
  readonly workspaceId: string;
  readonly type: CollaborationMessageType;
  readonly payload: {
    readonly title: string;
    readonly content: string;
    readonly structuredData?: Record<string, unknown> | undefined;
    readonly referencedResources?: readonly string[] | undefined;
  };
  readonly timestamp: number;
  readonly correlationId: string;
  readonly provenance: 'AGENT_REPORTED' | 'SYSTEM_OBSERVED' | 'SYSTEM_VERIFIED';
}
