export type HandoffStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED';

export interface AgentHandoff {
  readonly handoffId: string;
  readonly collaborationSessionId: string;
  readonly sourceAgentId: string;
  readonly targetAgentId: string;
  readonly taskId: string;
  readonly projectId: string;
  readonly summary: string;
  readonly completedWork: readonly string[];
  readonly remainingWork: readonly string[];
  readonly changedResources: readonly string[];
  readonly relevantContext?: Record<string, unknown> | undefined;
  readonly verificationStatus: 'UNVERIFIED' | 'AGENT_REPORTED' | 'SYSTEM_VERIFIED';
  readonly blockers: readonly string[];
  readonly timestamp: number;
  readonly status: HandoffStatus;
  readonly rejectionReason?: string | undefined;
}
