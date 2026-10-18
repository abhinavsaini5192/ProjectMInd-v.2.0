import type { AgentHandoff } from '../models/index.js';

export interface ProposeHandoffParams {
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
  readonly blockers?: readonly string[] | undefined;
}

export interface IHandoffCoordinator {
  proposeHandoff(params: ProposeHandoffParams): Promise<AgentHandoff>;
  acceptHandoff(handoffId: string, acceptingAgentId: string): Promise<AgentHandoff>;
  rejectHandoff(handoffId: string, rejectingAgentId: string, reason: string): Promise<AgentHandoff>;
  getPendingHandoffs(collaborationSessionId: string): Promise<AgentHandoff[]>;
}
