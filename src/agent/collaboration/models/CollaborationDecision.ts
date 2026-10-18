export type DecisionAuthority =
  | 'AGENT_PROPOSED'
  | 'TEAM_ACCEPTED'
  | 'SYSTEM_VERIFIED'
  | 'PROJECT_POLICY';

export type DecisionStatus = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'PROMOTED_TO_MEMORY';

export interface CollaborationDecision {
  readonly decisionId: string;
  readonly projectId: string;
  readonly collaborationSessionId: string;
  readonly taskId?: string | undefined;
  readonly decision: string;
  readonly rationaleSummary: string;
  readonly alternatives: readonly string[];
  readonly evidence: readonly string[];
  readonly participants: readonly string[];
  readonly authority: DecisionAuthority;
  readonly status: DecisionStatus;
  readonly timestamp: number;
  readonly promotedMemoryId?: string | undefined;
}
